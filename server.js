const express = require('express');
const path = require('path');
const cors = require('cors'); 
const axios = require('axios');
const querystring = require('querystring');  
const { DiscordData } = require('./discordData');


const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors({
  origin: '*',  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
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
      let dataFile = {};
      
      if (!err && data) {
        try {
          dataFile = JSON.parse(data);
        } catch (e) {
          dataFile = {};  
        }
      }

      if (!dataFile.servers) {
        dataFile.servers = [];
      }

      dataFile.servers.push(server);

      fs.writeFile(filePath, JSON.stringify(dataFile, null, 2), (writeErr) => {
        if (writeErr) {
          console.error('Error writing to file:', writeErr);
          return res.status(500).send('Error writing to file');
        }
        console.log('Server added to the list');
        res.send('Server added to the list');
      });
    });
  } 
  if (action === "addToList") {}
  if(action === "remove") {}
  if(action === "getList") {
    fs.readFile(filePath, 'utf-8', (err, data) => {
      console.log('data:', data);
      
    });
  }
  else {
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
  const { uuid,discord, wallet, type }  = req.body;
  const filePath = path.join(__dirname, 'files', 'users.json');
  if(type === "discord"){
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