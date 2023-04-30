import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

import axios from 'axios';
import { verifyJWT } from '../components/OIDC.mjs';
import Provider from 'oidc-provider';
import { Issuer, generators } from 'openid-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const MORGAN_FMT = ":remote-addr :method :url HTTP/:http-version :status :res[content-length] - :response-time ms - :user-agent";

app.use(logger(MORGAN_FMT, {
    skip: (req, res) => {
        req.url.includes("healthCheck") && (res.statusCode == 200 || res.statusCode == 304)
    }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static(`${__dirname}/../public`));

app.set('view engine', 'ejs');
app.set('views', `${__dirname}/../templates`);




const users = [{
    id: 'oidc_client',
    name: 'name',
    platform: 'none',
    secret: 'a_different_secret'
}];

let state;
let nonce;

const facebookIssuer = await Issuer.discover('https://www.facebook.com');
const facebookClient = new facebookIssuer.Client({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uris: ['https://oidcdebugger.com/debug'],
    response_types: ['id_token'],
});

const microsoftIssuer = await Issuer.discover('https://login.microsoftonline.com/consumers/v2.0');
const microsoftClient = new microsoftIssuer.Client({
    client_id: process.env.MICROSOFT_APP_ID,
    redirect_uris: ['http://localhost:3001/microsoft/callback'],
    response_types: ["id_token token"]
});

function makeSecret(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

function createUser(id,name,platform) {
    const secret = makeSecret(10);
    const user = {
        id: id.toString(),
        name,
        platform,
        secret: secret.toString()
    };
    if (!(users.map(u => u.id).includes(user.id))) 
        users.push(user);
    return user;
}

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/facebook', (req, res) => {
    res.render('facebook');
})

app.get('/facebook/login', async (req, res) => {
    nonce = generators.nonce();
    state = generators.state();

    const authorizationUrl = facebookClient.authorizationUrl({
        scope: 'openid',
        state,
        nonce,
        response_mode: 'form_post',
    });
    res.redirect(authorizationUrl);
});

app.get('/facebook/callback', async (req, res) =>{
    const id_token = req.query.id_token || '';
    const reqState = req.query.state || '';
    const platform = 'fb';
    const verification = await verifyJWT(id_token, nonce, state===reqState, platform);
    console.log(verification);
    if (verification[0] !== "valid token") {return};
    const user = createUser(verification[1].sub, verification[1].name, platform);
    providerInicializer();
    //console.log(createJWT(user.id, user.name));
    res.render("user", {userName: user.name, clientId: user.id, clientSecret: user.secret})
})

app.get('/microsoft/login', async (req, res) =>{
    nonce = generators.nonce();
    state = generators.state();

    const authorizationUrl = microsoftClient.authorizationUrl({
        scope: 'openid profile email',
        state,
        nonce,
        response_mode: 'form_post',
    });
    res.redirect(authorizationUrl);
})

app.post('/microsoft/callback', async (req, res) =>{
    const id_token = req.body.id_token;
    const reqState = req.body.state;
    const platform = 'ms';
    const verification = await verifyJWT(id_token, nonce, state===reqState, platform);
    console.log(verification);
    if (verification[0] !== "valid token") {res.redirect("http://localhost:3001")};
    const data = (await axios.get('https://graph.microsoft.com/oidc/userinfo', {
        headers: {
            'Authorization': `Bearer ${req.body.access_token}`,
        },
    })).data;
    const user = createUser(data.sub, data.name, platform);
    console.log(users)
    providerInicializer();
    //console.log(createJWT(user.id, user.name));
    res.render("user", {userName: user.name, clientId: user.id, clientSecret: user.secret})
});

app.get('/oauth/auth', (req, res) =>{
    const client_id = req.body.client_id || req.query.client_id || '';
    const response_type = req.body.response_type || req.query.response_type || '';
    const redirect_uri = req.body.redirect_uri || req.query.redirect_uri || false;
    const scope = req.body.scope || req.query.scope || '';

    let error = false;

    if (!(users.map(u => u.id).includes(client_id)))
        error = "invalid client id";
    if (response_type !== 'authorization_code' && response_type !== 'code')
        error = "invalid response type";
    if (!redirect_uri) 
        error = "invalid redirect uri";
    if (scope !== 'token' && scope !== 'openid token' && scope !== 'token openid')
        error = 'invalid scopes';

    if (error) {
        console.log(error);
        res.redirect(`${redirect_uri}?error=${error}`);
    }

    else res.redirect(`http://localhost:3001/oidc/auth?client_id=${client_id}&response_type=code&response_mode=query&redirect_uri=${redirect_uri}&code_challenge=nqWxOqTBUa9iu9G5pL6LWChLS5TYEcyhwWbbQlj79ZU&code_challenge_method=S256&scope=token%20openid`)
})

app.post('/oauth/token', async (req, res) =>{
    const client_id = req.body.client_id || req.query.client_id || '';
    const client_secret = req.body.client_secret || req.query.client_secret || '';
    const redirect_uri = req.body.redirect_uri || req.query.redirect_uri || false;
    const code = req.body.code || req.query.code || false;

    let error = false;

    if (!(users.map(u => u.id).includes(client_id)))
        error = "invalid client id";
    if (users.filter(u => u.id === client_id && u.secret === client_secret).length === 0)
        error = "invalid client secret";
    if (!redirect_uri) 
        error = "invalid redirect uri";
    if (!code)
        error = 'invalid code';

    if (error) {
        console.log(error);
       return error
    }

    const auth = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
    const response = await axios.post(`http://localhost:3001/oidc/token`, {
            grant_type: 'authorization_code',
            code,
            redirect_uri,
            code_verifier: 'WzE2NywxMDgsMTEyLDU1LDIxOSwxNjksODAsMTQxLDQsNCwyNTMsOCwxNDksNDYsNjAsMTI4XQ'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth}`
            }
        }).catch(console.log);

    return {...response.data};

});

function providerInicializer(){
    const clients = [];
    users.forEach(u => clients.push({
        client_id: u.id,
        client_secret: u.secret,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        redirect_uris: ['https://oauthdebugger.com/debug'],
    }));
    const configuration = {
        clients,
    };

    const provider = new Provider('http://localhost:3001', configuration);
    app.use('/oidc', provider.callback());
}

export default app;