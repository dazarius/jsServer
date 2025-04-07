const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const querystring = require('querystring');  
const fs = require('fs');




let data = {};

async function DiscordData(access_token) {
    try {
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
            }
        });

        const user = userResponse.data;
        const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
        const uuid = generateShortUUID(user.id);
        user.avatar = avatarUrl;
        data['user'] = user

        const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
            }
        });

        const guilds = guildsResponse.data;
        const owner = guilds.filter(guild => guild.owner === true);
        data['guilds'] = owner
        console.log('guildsData', data['guilds']);

        // data['guilds'] = guilds.map(guild => guild.name);
        const data2 = {
            user:data,
            uuid: uuid
        }
        console.log('data2', data2);
        let existingData = {};

        const filePath = path.join(__dirname, 'files', 'users.json');
        if(fs.existsSync(filePath)){
            const f = fs.readFileSync(filePath, 'utf-8');
            existingData = JSON.parse(f);
        }
        existingData[uuid] = data;

        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
        
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

