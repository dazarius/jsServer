const express = require('express');
const path = require('path');
const cors = require('cors'); 
const axios = require('axios');
const querystring = require('querystring');  
const { DiscordData } = require('./discordData');


const fs = require('fs');

const app = express();
const port = 3001;

app.use(express.json());
app.use(cors({
  origin: '*',  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/api1/loadData', (req, res) => {
  console.log('loadData');
  
  // Извлекаем параметр uuid из строки запроса

  const filePath = path.join(__dirname, 'files', 'users.json');
  const files = ['commands.json', 'serverList.json'];
  const data = {};

  // Чтение основного файла users.json
  fs.readFile(filePath, 'utf-8', (err, fileData) => {
    if (err) {
      return res.status(500).send('Error reading users file');
    }

    const usersData = JSON.parse(fileData);

    // Проверяем, есть ли uuid в данных пользователей
      

      // Чтение дополнительных файлов
      let filePromises = files.map(file => {
        return new Promise((resolve, reject) => {
          const filePath = path.join(__dirname, 'files', file);
          fs.readFile(filePath, 'utf-8', (err, fileData) => {
            if (err) {
              reject(`Error reading ${file}`);
            } else {
              resolve(JSON.parse(fileData));
            }
          });
        });
      });

      Promise.all(filePromises)
        .then(fileContents => {
          data.commands = fileContents[0];  
          data.serverList = fileContents[1];  
          
          res.json(data);  // Отправляем ответ
        })
        .catch(error => {
          res.status(500).send(error);  // Обрабатываем ошибку чтения файлов
        });

  });
});


app.get('/api1/authDC', (req, res) => {
    const filePath = path.join(__dirname, 'files', 'discorAuth.json');  
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        res.status(500).send('Error reading file');
      } else {
        const authDC = JSON.parse(data);
        res.json(authDC);
      }
    });
}); 

app.post('/api1/exchange-code', (req, res) => {
  const { code } = req.body; 

  let clientId, clientSecret, redirectUri;

  const filePath = path.join(__dirname, 'files', 'discorAuth.json');
  fs.readFile(filePath, 'utf-8', (err, fileData) => {
      if (err) {
          console.error('Error reading file:', err);
          return res.status(500).send('Error reading file');
      }

      try {
          const dataDc = JSON.parse(fileData);
          clientId = dataDc.client_id;
          clientSecret = dataDc.client_secret;
          redirectUri = dataDc.redirect_url;

          axios.post('https://discord.com/api/v10/oauth2/token', querystring.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              code: code,
              grant_type: 'authorization_code',
              redirect_uri: redirectUri,
              scope: 'identify',
          }), {
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
              },
          })
          .then(async (tokenResponse) => {
              const refreshToken = tokenResponse.data.refresh_token;
              const accessToken = tokenResponse.data.access_token;

              const { user, uuid} = await DiscordData(accessToken);
              console.log('data:', user);
              console.log('uuid:', uuid);

              const dataToken = {
                  refreshToken: refreshToken,
                  accessToken: accessToken,
              };
              res.json({ 
                token: dataToken, userData: user, 
                uuid: uuid
              });
          })
          .catch((error) => {
              console.error('Error during token exchange:', error);
              res.status(500).send('Error during token exchange');
          });
      } catch (jsonError) {
          console.error('Error parsing JSON:', jsonError);
          res.status(500).send('Error parsing configuration file');
      }
  });
});


app.post('/api1/serverList', (req, res) => {
  const params = req.body;
  const { action, server } = params;
  const filePath = path.join(__dirname, 'files', 'serverList.json');

  if (action === "sync") {
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).send('Error reading file');  // Отправляем ответ и прерываем выполнение
      }
      
      let dataFile = JSON.parse(data);
      if(!dataFile.servers) {
        dataFile.servers = [];  
      }
      dataFile.servers = server 

      fs.writeFile(filePath, JSON.stringify(dataFile, null, 2), (writeErr) => {
        if (writeErr) {
          console.error('Error writing to file:', writeErr);
          return res.status(500).send('Error writing to file');  // Отправляем ответ и прерываем выполнение
        }

        console.log('Server added to the list');
        res.send('Server added to the list');  // Отправляем успешный ответ
      });
    });
  } else {
    res.status(400).send('Invalid action');
  }
});

app.post('/api1/registerCommand', (req, res) => {
  const type = req.body.type;
  const command = req.body.data;
  const action = req.body.action;

  const filePath = path.join(__dirname, 'files', 'commands.json');
  
  if (!fs.existsSync(filePath)) {
      const data = {};
      fs.writeFileSync(filePath, JSON.stringify(data));
  }
  if (action === "register") {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
          console.error('Error reading file:', err);
          return res.status(500).send('Error reading file');z
      }

      let fileData
      fileData = JSON.parse(data);
      
      fileData[type] = command;

      fs.writeFile(filePath, JSON.stringify(fileData, null, 2), (err) => {
          if (err) {
              console.error('Error writing file:', err);
              return res.status(500).send('Error writing file');
          } else {
              console.log('Command registered');
              res.status(200).send('Command registered');
          }
      });
  });
  } else if (action === "getFullList") {
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).send('Error reading file');
      }
      const commands = JSON.parse(data);
      res.json(commands);
    });
  } else if (action === "remove") {
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).send('Error reading file');
      }
      const commands = JSON.parse(data);
      commands[type] = commands[type].filter((item) => item !== command);
      fs.writeFile(filePath, JSON.stringify(commands, null, 2), (err) => {
        if (err) {
          console.error('Error writing file:', err);
          return res.status(500).send('Error writing file');
        }
        res.status(200).send('Command removed');
      });
    });
  } else {
    res.status(400).send('Invalid action');
  }
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});



app.get('/api1/getCommands', (req, res) => {
  file_path = path.join(__dirname, 'files', 'commands.json');
  fs.readFile(file_path, 'utf-8', (err, data) => {
      if (err) {
          console.error('Error reading file:', err);
          return res.status(500).send('Error reading file');
      }

      const commands = JSON.parse(data);
      res.json(commands);
  });
});


app.post('/api1/userData', (req, res) => {
  const {action, uuid,discord, wallet, type }  = req.body;
  const filePath = path.join(__dirname, 'files', 'users.json');
  if(action === "setData"){
    
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
          console.error('Error reading file:', err);
          return res.status(500).send('Error reading file');
      }
  
      let fileData = JSON.parse(data);
  
      if (!fileData[uuid]) {
          fileData[uuid] = {};
      }
  
      fileData[discord] = wallet;
      
      fs.writeFile(filePath, JSON.stringify(fileData, null, 2), (err) => {
          if (err) {
              console.error('Error writing file:', err);
              return res.status(500).send('Error writing file');
          } else {
              res.status(200).send('User data saved');
          }
      });
    });
  }
  else if(type === "wallet"){
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
          console.error('Error reading file:', err);
          return res.status(500).send('Error reading file');
      }
  
      let fileData = JSON.parse(data);
  
      
  
      fileData[uuid] = {
        "wallet": wallet,
      };
      
      fs.writeFile(filePath, JSON.stringify(fileData, null, 2), (err) => {
          if (err) {
              console.error('Error writing file:', err);
              return res.status(500).send('Error writing file');
          } else {
              res.status(200).send('User data saved');
          }
      });
    });
  }
  
})


app.get('/api1/chainAutocomplete', (req, res) => {
  const { get } = req.query;
  file_path = path.join(__dirname, 'files/contracts', `${get}.json`);
  fs.readFile(file_path, 'utf-8', (err, data) => {
      if (err) {
          console.error('Error reading file:', err);
          return res.status(500).send('Error reading file');
      }

      const commands = JSON.parse(data);
      res.json(commands);
  });

})  



app.get('/api1/discordBotData', (req, res) => {
  const { re } = req.query;
  console.log('re:', re);
  let data = {};
  if(re === "contract") {
    file_path = path.join(__dirname, 'files', 'contracts');
    const files = fs.readdirSync(file_path).filter(file => file.endsWith('.json'));
    console.log('files:', files);
    files.forEach((file, index) => {
      const fullPath = path.join(file_path, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      try {
        data[file] = JSON.parse(content);
        
      } catch (e) {
        console.error(`Ошибка парсинга ${file}:`, e);
      }
    })
    console.log('data:', data);
    
    
  }
  if(re === "config") {
    file_path = path.join(__dirname, 'files', 'users.json');
  }
  res.json(data);

  
})