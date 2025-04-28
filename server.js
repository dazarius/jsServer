const express = require('express');
const path = require('path');
const cors = require('cors'); 
const axios = require('axios');
const querystring = require('querystring');  
const { DiscordData } = require('./discordData');
const { createWallet,dayliclaim, customContract } = require('./web3'); // Импортируем функцию createWallet
const archiver = require('archiver');


const fs = require('fs');
const { waitForDebugger } = require('inspector');
const { json } = require('stream/consumers');
const e = require('cors');

const app = express();
const port = 3000;

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

              const dat = await DiscordData(accessToken);
              console.log('Finaldata:', dat);

              const dataToken = {
                  refreshToken: refreshToken,
                  accessToken: accessToken,
              };
              res.json({ 
                userData: dat, 
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






app.get('/api1/programmConfig', (req, res) => {
  
  const { re } = req.query;
  let data = {};
  if(re === "programmConfig"){
    const zipname = `${re}.zip`;
    const file_path = path.join(__dirname, 'files', re);
    const zipPath = path.join(__dirname, 'temp', zipname); // ./temp/programmConfig.zip

    // Убедимся, что temp-папка есть
    fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, zipname, (err) => {
        if (!err) {
          fs.unlinkSync(zipPath); // удалим архив после отправки
        }
      });
    });

    archive.on('error', err => {
      res.status(500).send({ error: err.message });
    });

    archive.pipe(output);
    archive.directory(file_path, false);
    archive.finalize();    }


  console.log('data:', data);
  
  
  

  
})



app.post('/api1/transact', async (req, res) => {
  const { id,contract, rpc, abi, action } = req.body;

  let {walletKey, address } = await getWallet(id);
  console.log('wallet:', walletKey);
  console.log('address:', address);
  if(!walletKey) {
    return res.status(404).json({ error: "Wallet not found" });
  }
  if(action === "daily"){
      
      dayliclaim(contract, abi, rpc, walletKey, address)
      .then((receipt) => {
        if (receipt.status === "claimed") {
          console.log("✅ Claim success:", receipt);
          res.status(200).json({receipt});
        }
        
      })
      .catch((err) => {
        console.error("❌ Transaction failed:", err);
        res.status(500).json({error: "Transaction failed"});

      });

  }
  else if(action === "cheque"){}
});
  

app.post('/api1/customContractIteraction', async (req, res) => {
  const data = req.body;
  // console.log('data:', data);
  const { contract, abi, func, rpc,  args } = data;
  let {walletKey, address } = await getWallet(data.id);
  // console.log('wallet:', wallet);
  const interact = await customContract(
    contract,
    abi,
    func,
    rpc,
    walletKey,
    args
  )
  try{
    if (interact.error){
      console.error("❌ Transaction failed:", interact.error);
      return res.status(400).json({ 
        status: "failed ❌", 
      });
    }
    if (interact.status === "view") {
      try{
        let strData = deepToString(interact);
        res.json(strData);  
      }
      catch(err) {
        console.error("❌ Transaction failed:", err);
        res.status(500)
      }
    }
    
    if (interact.status === "success") {
      try{
        let strData = deepToString(interact);
        res.json(strData);  
    
      }
      catch(err) {
        console.error("❌ Transaction failed:", err);
        res.status(500)
      }
    }
    else if (interact.status === "Transaction failed") {
      return res.status(400).json({ 
        status: "failed ❌" 
      });
    }
  }
  catch(err){
    console.error("❌ Transaction failed:", err);
    return res.status(500).json({ 
      status: "failed ❌", 
    });
  }
  
  
})

app.get('/api1/serverConfigLoad', (req, res) => {
  const{ id } = req.query;
  file_path = path.join(__dirname, `files/servers/${id}`);
  console.log('file_path:', file_path);
  const zipname = `${id}.zip`;
  res.status(200);
  
})
app.post('/api1/server', (req, res) => {
  const files = [
    {
      name: "contracts.json",
      template: {
        "contract": {
          "contractName": {
            "contractAddress": "0x123",
            "abi": [],
            "contract_access_channel": "channel id",
            "rpc": "https://example.com",
            "function": {
              "funcName": {
                "args": ["arg1", "arg2"],
                "type": "view",
                "access": "user/role id",

              }
            },
          }
        }
          
        }
      }, 
      {
        name: "commands.json",
        template: {
          "slashcommand": {
            "commandId": {
              
              "access": "user/role id",
            },
            "prefixCommand": {
              "commandId": {
                "access": "user/role id",
              }

            }
          }
        }
      }
    ];

  const { action, id, fileName } = req.body;
  const serverFolderPath = path.join(__dirname, `files/servers/${id}`);

  if (!fs.existsSync(serverFolderPath)) {
    console.error('Folder does not exist:', serverFolderPath);
    fs.mkdirSync(serverFolderPath, { recursive: true });
  }

  if (action === "get") {
    // создаём файлы
    files.forEach(file => {
      const fileFullPath = path.join(serverFolderPath, file.name);
      if (!fs.existsSync(fileFullPath)) {
        fs.writeFileSync(fileFullPath, JSON.stringify(file.template, null, 2), 'utf8');
        console.log('Created file with template:', fileFullPath);
      }
    });

    try {
      const createdFiles = fs.readdirSync(serverFolderPath);
      const jsonFiles = createdFiles.filter(file => path.extname(file).toLowerCase() === '.json');
      return res.status(200).json({ servers: jsonFiles });
    } catch (err) {
      console.error('Error reading directory:', err);
      return res.status(500).send('Server error');
    }
  }

  if (action === "getFileRaw") {
    // читаем конкретный файл
    try {
      const fileFullPath = path.join(serverFolderPath, fileName);
      const fileContent = fs.readFileSync(fileFullPath, 'utf-8');
      const parsedData = JSON.parse(fileContent);

      return res.status(200).json(parsedData);
    } catch (error) {
      console.error('Failed to read or parse file:', error);
      return res.status(500).json({ error: 'Failed to read or parse file.' });
    }
  }
});




  






async function getWallet(id) {
  const filePath = path.join(__dirname, 'files', 'users', `${id}.json`);

  if (!fs.existsSync(filePath)) {
    console.error('File does not exist:', filePath);
    return null;  
  }

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return reject("Error reading file");
      }

      let fileData = JSON.parse(data);
      let walletKey = fileData.user.wallet.privateKey.ethereum;
      let address = fileData.user.wallet.address.ethereum;
      resolve({
        walletKey,
        address
      });

    });
  });
}




function deepToString(obj) {
  if (Array.isArray(obj)) {
    return obj.map(deepToString);
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = deepToString(obj[key]);
    }
    return newObj;
  } else {
    return String(obj);
  }
}
