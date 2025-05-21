const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const querystring = require('querystring');  
const fs = require('fs');
const { createWallet } = require('./web3'); // Импортируем функцию createWallet
const { config } = require('process');





function generateApiKey({ userId, walletAddress}) {
    const data ={}
    const raw = `${userId}-${walletAddress}-${Date.now()}`;
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
      .then(buffer => {
        return Array.from(new Uint8Array(buffer))
          .map(b => b.toString(16).padStart(2, "0"))
          .join(""); // Вернёт хеш как строку (hex)
      });
  }
  


let data = {

};

async function DiscordData(access_token) {
    try {
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
            }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
        user.avatar = avatarUrl;
        data['user'] = user
        
        const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
            }
        });

        const guilds = guildsResponse.data;
        const owner = guilds.filter(guild => guild.owner === true);
        data["user"]['guilds'] = owner;
        console.log('owner', owner);
        wallet = createWallet({
            main:true
        });
        const firstKey = Object.keys(wallet)[0];
        const walletAddress = wallet[firstKey].address.ethereum;

        const apiKey = await generateApiKey({ userId: user.id, walletAddress: walletAddress });
        data['user']['wallet'] = wallet;
        data['token'] = apiKey;
        

        // data['guilds'] = guilds.map(guild => guild.name);
        let data2 = {
            user:data,
            wallet: wallet,
            ownGuilds: owner,
            token: apiKey,
            config: {
                user_max_wallets: 5,
            }
            

        }
        let existingData = {};
        const config =  {
            user_max_wallets: 5,
        }
        const filePath = path.join(__dirname, 'files/users', `${user.id}.json`);
        if(fs.existsSync(filePath)){
            const f = fs.readFileSync(filePath, 'utf-8');
            existingData = JSON.parse(f);
            console.log('existingData', existingData);

            if (existingData.user.config) {
                data2.config = existingData.user.config;
                data.user.config = existingData.user.config;
            }
            else {
                data2.config = config;
                data.user.config = data2.config;
            }
             ;
        }
        existingData = data;
        
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
        console.log('data2 in discordData', data2);
        
        return data2;
    } catch (err) {
        console.error('Ошибка при получении данных:', err);
        throw err; 
    }
}


function generateShortUUID(discordId) {
    const timestamp = Date.now().toString();
    const data = `${discordId}-${timestamp}`;

    const hash = crypto.createHash('sha256');
    hash.update(data);

    // console.log(hash.digest('hex').slice(0, 8))
    return hash.digest('hex').slice(0, 8);
}
module.exports = { DiscordData };

