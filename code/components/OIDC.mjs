import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export async function verifyJWT(id_token, nonce, state, platform) {
    const jwksUri = platform === 'fb' ? 
        'https://www.facebook.com/.well-known/oauth/openid/jwks/' :
        "https://login.microsoftonline.com/consumers/discovery/v2.0/keys";

    const client = jwksClient({jwksUri});

    try {
        const decoded = jwt.decode(id_token, { complete: true });
        const kid = decoded.header.kid;

        const key = await new Promise((resolve, reject) => {
            client.getSigningKey(kid, (err, key) => {
            if (err) {
                reject(err);
            } else {
                resolve(key.getPublicKey());
            }
            });
        });
        
        const now = Math.floor(Date.now() / 1000);
        if (decoded.payload.exp < now) {
            return ["token expired"];
        }

        const payload = jwt.verify(id_token, key);


        if (!state) {
            return ["invalid state"];
        }

        if (nonce !== payload.nonce) {
            return ["invalid nonce"];
        }
        if ((platform === 'fb' && process.env.FACEBOOK_APP_ID !== payload.aud) || (platform === 'ms' && process.env.MICROSOFT_APP_ID !== payload.aud)) {
            return ["invalid app id"];
        }

        if (
            (platform === 'fb' && "https://www.facebook.com" !== payload.iss) || 
            (platform === 'ms' && "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0" !== payload.iss)
            ) { return ["invalid issuer"]; }
        
        return ["valid token",payload];

    } catch (err) {
        return ["invalid token"];
    }
}

