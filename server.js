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
      try{
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
      catch(err) {
        console.error("❌ something went wrong:", err);
        res.status(500).json({error: "something went wrong"});
      }
      

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
    res.destroy(err); 

  }
  
  
})



app.post("/api1/serverFolderLoad", (req, res) => {
  console.log("📥 serverFolderLoad");
  const { id, roles, channels } = req.body;

  const folderPath = path.join(__dirname, "files", "servers", id);
  const configPath = path.join(folderPath, "config.json");

  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: "Folder not found" });
  }

  // Обновление config.json
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (err) {
      console.error("❌ Ошибка чтения config.json:", err);
    }
  }
  config.roles = roles;
  config.channels = channels;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log("✅ config update");

  // === Архивация и отправка напрямую в res ===
  const archive = archiver("zip", { zlib: { level: 9 } });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${id}.zip"`);

  archive.on("error", (err) => {
    console.error("❌ Ошибка архивации:", err);
    res.status(500).end();
  });

  archive.on("end", () => {
    console.log("✅ Архив отправлен клиенту");
  });

  archive.pipe(res);
  archive.directory(folderPath, false);
  archive.finalize();
});

app.post('/api1/updateApiKey', (req, res) => {
  const { user, key } = req.body;
  const filePath = path.join(__dirname, 'files', `users/${user}.json`);
  if (!fs.existsSync(filePath)) {
    console.error('File does not exist in updateApiKey:', filePath, "api key:", key, "user:", user);
    return res.status(404).json({ error: "File not found" });
  }
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }

    let fileData = JSON.parse(data);
    fileData.user.token = key;

    fs.writeFile(filePath, JSON.stringify(fileData, null, 2), (err) => {
      if (err) {
        console.error('Error writing file:', err);
        return res.status(500).send('Error writing file');
      } else {
        console.log('API key updated');
        res.status(200).send('API key updated');
      }
    });
  });

});

app.post('/api1/server', async(req, res) => {
  const files = [
    {
      name: "contracts.json",
      template: {
        "contract": {
          "contractName": {
            "address": "0x123",
            "abi": [],
            "contract_access_channel": "channel id",
            "rpc": "https://example.com",
            "function": {
              "funcName": {
            
                "access": [1,2,4,5],

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
      },
      {
        name:"config.json",
        template: {
          "prefix": "!",
          "max_user_wallet": 5,
          "max_user_giuld_contract_functions":5,
          "max_user_guilds_contract": 2,
          "role":[],
          "TextChannel":[]
        }
      }
    ];

  const { action, d, serverId, fileName,userId } = req.body;
  const userDat = await getUserData({
    userId: userId,
    token: req.headers['authorization'],

  });
  if (!userDat) {
    return res.status(404).json({ error: "User data not found" });
  }
  console.log('userDat:', userDat.guilds);
  const token = req.headers['authorization'];
  console.log('token:', token);


  const serverFolderPath = path.join(__dirname, `files/servers/${serverId}`);

  if (action === "get") {
    if (!fs.existsSync(serverFolderPath)) {
      console.error('Folder does not exist:', serverFolderPath);
      fs.mkdirSync(serverFolderPath, { recursive: true });

    }
  
    files.forEach(file => {
      const fileFullPath = path.join(serverFolderPath, file.name);
      if (!fs.existsSync(fileFullPath)) {
        fs.writeFileSync(fileFullPath, JSON.stringify(file.template, null, 2), 'utf8');
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
    const serverFolderPath = path.join(__dirname, `files/servers/${serverId}`);
    console.log('serverFolderPath:', fileName);

    try {
      const fileFullPath = path.join(serverFolderPath, fileName);
      const fileContent = fs.readFileSync(fileFullPath, 'utf-8');
      const parsedData = JSON.parse(fileContent);

      return res.status(200).json({
        content: parsedData,
        serverId: serverId,
      });
    } catch (error) {
      console.error('Failed to read or parse file:', error);
      return res.status(500).json({ error: 'Failed to read or parse file.' });
    }
  }
  if (action === "addContracts") {
    const contractData = d;
    
    // console.log('contractData:', JSON.stringify(contractData));

    Object.keys(contractData).forEach((key) => {
      const id = key.split('-')[1]
      const contracts = contractData[key].contract;

      // console.log('key:', key);
      // console.dir(contractData[key], { depth: null });
      for (const contractId in contracts) {
        const contractEntry = contracts[contractId];
        if (typeof contractEntry.abi === 'string') {
          try {
            contractEntry.abi = JSON.parse(contractEntry.abi);
          } catch (e) {
            console.warn(`⚠️ Failed to parse ABI for contract ${contractId} (server ${id})`);
          }
        }
        if (contractEntry.contract_access_channel === "*"){
          contractEntry.contract_access_channel = "*";
        }
        else{
          try{
          
            contractEntry.contract_access_channel = extractFirstNumberFromString(contractEntry.contract_access_channel);
            
          }
          catch(e) {
            console.warn(`⚠️ Failed to parse contract_access_channel for contract ${contractId} (server ${id})`);
            contractEntry.contract_access_channel = 0;
          }
        }
        
        for(const funcName in contractEntry.function) {
          const funcEntry = contractEntry.function[funcName];
          if (typeof funcEntry.value === 'string') {
            try {
              funcEntry.value = extractFirstNumberFromString(funcEntry.value, "float");
            } catch (e) {
              console.warn(`⚠️ Failed to parse access for function ${funcName} in contract ${contractId} (server ${id})`);
            }
          }
          if (typeof funcEntry.access === 'string') {
            try {
              funcEntry.access = funcEntry.access
                .split(',')
                .map(s => s.trim())
                .map(s => isNaN(s) ? s : Number(s));
            } catch (e) {
              console.warn(`⚠️ Failed to parse access for function ${funcName} in contract ${contractId} (server ${id})`);
              funcEntry.access = [];
            }
          } else if (Array.isArray(funcEntry.access)) {
            funcEntry.access = funcEntry.access.map(s => {
              if (typeof s === 'string') s = s.trim();
              return isNaN(s) ? s : Number(s);
            });
          }
          
        }
      }

      console.log('======================================');

      const filePath = path.join(__dirname, `files/servers/${id}` , 'contracts.json');
      fs.writeFileSync(filePath, JSON.stringify(contractData[key], null, 2), 'utf8');


    })
    res.status(200).json({ message: 'Contracts added successfully' });
    
  }
});

app.post('/api2/server', async (req, res) => {
  const { userId, action, d } = req.body;
  const token = req.headers['authorization'];
  // console.log("data in server2.0",'userId:', userId, "token:", token);
  if (!userId || !token) {
    return res.status(400).json({ error: 'Missing userId or authorization' });
  }

  const userDat = await getUserData({ userId, token });

  if (!userDat) {
    return res.status(404).json({ error: 'User or guilds not found' });
  }
  const user = userDat.user;
  const filesTemplates = [
    {
      name: 'contracts.json',
      template: {
        contract: {
          contractName: {
            address: '0x123',
            abi: [],
            contract_access_channel: 'channel id',
            rpc: 'https://example.com',
            function: {
              funcName: {
                access: [1, 2, 4, 5],
              },
            },
          },
        },
      },
    },
    {
      name: 'commands.json',
      template: {
        slashcommand: {
          commandId: {
            access: 'user/role id',
          },
          prefixCommand: {
            commandId: {
              access: 'user/role id',
            },
          },
        },
      },
    },
    {
      name: 'config.json',
      template: {
        prefix: '!',
        max_user_wallet: 5,
        max_user_giuld_contract_functions: 5,
        max_user_guilds_contract: 2,
        role: [],
        TextChannel: [],
      },
    },
  ];
  let files = {}
  const allServerFiles = {};
  for (const guild of user.guilds) {
    const serverId = guild.id;
    const serverName = guild.name;
    console.log('serverId:', serverId);
    console.log('serverName:', serverName);
    const serverFolderPath = path.join(__dirname, `files/servers/${serverId}`);

    // Создаём папку сервера, если не существует
    if (!fs.existsSync(serverFolderPath)) {
      fs.mkdirSync(serverFolderPath, { recursive: true });
    }

    // Создаём недостающие файлы
    for (const file of filesTemplates) {
      const fileFullPath = path.join(serverFolderPath, file.name);
      if (!fs.existsSync(fileFullPath)) {
        fs.writeFileSync(fileFullPath, JSON.stringify(file.template, null, 2), 'utf8');
      }
    }

    // Читаем все .json файлы сервера
    const filesInServer = fs.readdirSync(serverFolderPath).filter(f => f.endsWith('.json'));

    const contentByFile = {};

    for (const filename of filesInServer) {

      try {
        const fileContent = fs.readFileSync(path.join(serverFolderPath, filename), 'utf8');
        contentByFile[filename.replace('.json', '')] = JSON.parse(fileContent);
      } catch (e) {
        console.warn(`⚠️ Failed to read file: ${filename} for server ${serverId}`);
      }
    }

    allServerFiles[serverId] = contentByFile;
    files[serverId] = {
      name: serverName,
      files: filesInServer
    }; 
  }
  if (action === "addContracts") {
    const userGuild = user.guilds
    console.log('userGuild:', userGuild);
    for (const key in d) {
      if (d.hasOwnProperty(key)) {
        const serverId = key.split('-')[1]; // Из "contracts-123..." → "123..."
        const filePath = path.join(__dirname, `files/servers/${serverId}`, 'contracts.json');

        const contractsData = d[key];
        fs.writeFile(filePath, JSON.stringify(contractsData, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error writing file:', err);
            return res.status(500).send('Error writing file');
          }
          console.log('Contracts data saved to file:', filePath);

        })
    // console.log("🔧 serverId:", serverId);
    // console.log("📄 contracts:", contractsData);
    
    // дальше можешь сохранять, обрабатывать и т.п.
  }
}
  }

  res.status(200).json({ servers: allServerFiles, file: files });
});


app.get('/api2/loadConfig', async (req, res) => {
  const token = req.headers.authorization;
  const userId = req.query.userId || req.query.id;
  if(!getUserData({userId, token})){
    
    res.status(404).json({ error: "authorization failed" });
  }
  const filePath = path.join(__dirname, 'files', 'users', `${userId}.json`);
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist:', filePath);
      return res.status(404).json({ error: "File not found" });
    }
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).send('Error reading file');
      }
      const config = JSON.parse(data).user.config;
      res.json(config);
    });
  
})
app.post('/api2/updateUserData', async (req, res) => {
  const {userId, target, userData} = req.body;
  const token = req.headers['authorization'];
  const userExist = await getUserData({
    userId: userId,
    token: token,
  });
  if (!userExist) {
    return res.status(404).json({ error: "authorization failed" });
  }
  const filePath = path.join(__dirname, 'files', 'users', `${userId}.json`);
  let existFile = {};
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file');
    }
    existFile = JSON.parse(data);
    
    if (target === "wallet") {
      console.log("data from req:", userData);
      console.log("data from file:", existFile.user.wallet);
      existFile.user.wallet = userData;
      console.log("data from file after added data from req:", existFile.user.wallet);
      fs.writeFile(filePath, JSON.stringify(existFile, null, 2), (err) => {
        if (err) {
          console.error('Error writing file:', err);
          return res.status(500).send('Error writing file');
        } else {
          console.log('User data saved');
          res.status(200).send('User data saved');
        }
      })
      
    }
    // fs.writeFile(filePath, JSON.stringify(existFile, null, 2), (err) => {
    //   if (err) {
    //     console.error('Error writing file:', err);
    //     return res.status(500).send('Error writing file');
    //   } else {
    //     console.log('User data saved');
    //     res.status(200).send('User data saved');
    //   }
    // });
  })
})

  

app.post('/api2/updateUserData', async (req, res) => {
  const {userId, type,wallet  } = req.body;
  const token = req.headers['authorization'];
  const userExist = await getUserData({
    userId: userId,
    token: token,
  });
  if (!userExist) {
    return res.status(404).json({ error: "authorization failed" });
  }
  if (type === "wallet") {
    console.log("updateUserData:", wallet);
    const filePath = path.join(__dirname, 'files', 'users', `${userId}.json`);
    let fileData = {};
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      fileData = JSON.parse(data);
    }
  }
})




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
      const firstKey = Object.keys(fileData.user.wallet)[0];
      const wallet = fileData.user.wallet[firstKey];
      let walletKey = wallet.privateKey.ethereum;
      let address = wallet.address.ethereum;
      resolve({
        walletKey,
        address
      });

    });
  });
}

async function getUserData({ userId, token }) {
  const filePath = path.join(__dirname, "files", "users", `${userId}.json`);

  if (!fs.existsSync(filePath)) {
    console.error("❌ File does not exist in getUserDat:", filePath, "userId:", userId);
    return null;
  }

  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    const fileData = JSON.parse(data);
    const userToken = fileData.token;
    // console.log("🔐 user token (from request):", token);
    // console.log("📁 token (from file):", userToken);

    if (userToken !== token) {
      console.error("❌ Token mismatch");
      return null;
    }

    // console.log("✅ Token match!");
    return fileData;

  } catch (err) {
    console.error("❌ Error reading/parsing file:", err);
    return null;
  }
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


function extractFirstNumberFromString(input, math) {
  if (typeof input !== 'string') return 0;
  const r = math;
  const parts = input.split(',');

  for (const part of parts) {
    if(math === "int"){
      const num = parseInt(part.trim(), 10);
      if (!isNaN(num)) {
        return num;
      }
    }
    else if(math === "float"){
      const num = parseFloat(part.trim());
      if (!isNaN(num)) {
        return num;
      }
    }
    
  }

  return 0; // если ничего не найдено
}


