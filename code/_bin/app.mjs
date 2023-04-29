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
    name: 'teste',
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
    const user = {
        id,
        name,
        platform,
        secret: makeSecret(10)
    };
    if (!(users.map(u => u.id).includes(id))) 
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
    providerInicializer();
    //console.log(createJWT(user.id, user.name));
    res.render("user", {userName: user.name, clientId: user.id, clientSecret: user.secret})
});


function providerInicializer(){
    const clients = [];
    users.forEach(u => clients.push({
        client_id: u.id,
        client_secret: u.secret,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        redirect_uris: ['https://oauthdebugger.com/debug'],
        scopes: ['data'],
    }));
    const configuration = {
        clients,
        claims: {
            data: ['data']
        },
        pkce: {
            required: false
        },
    };

    const provider = new Provider('http://localhost:3001', configuration);
    app.use('/oidc', provider.callback());
}

export default app;