import readline from 'node:readline/promises';
import fs from 'node:fs';

const rl = readline.createInterface(process.stdin, process.stdout);

let csrfToken;
let username;
let password;

try {
    const csrfReq = await fetch("https://www.mynelson.com/api/auth/csrf", {
        headers: {
            'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36`
        }
    });
    const csrfRev = await csrfReq.json();
    csrfToken = csrfRev.csrfToken
}
catch (er) {
    console.error('Nelson server not available, try again?');
    process.exit(1)
}

async function authorize() {
    username = await rl.question('username: ');
    password = await rl.question('password: ');
    
    const body = new FormData();
    body.set("redirect", false);
    body.set("username", username);
    body.set("password", password);
    body.set("csrfToken", csrfToken);
    body.set("json", true);

    const resp = await fetch("https://www.mynelson.com/api/auth/callback/nedces?", {
        method: "POST",
        headers: {
            'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36`
        },
        body: new URLSearchParams({
            'redirect': true,
            'username': username,
            'password': password,
            'csrfToken': csrfToken,
            'callbackUrl': "https://www.mynelson.com/?callbackUrl=https%3A%2F%2Fwww.mynelson.com%2Fdashboard",
            'json': true
        })
    });
    console.log(resp.headers.get('set-cookie'))
}

authorize();

