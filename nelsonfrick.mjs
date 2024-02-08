import readline from 'node:readline';
import fs from 'node:fs';

const rl = readline.createInterface(process.stdin, process.stdout);

let csrfToken;
let username;
let password;
let jar;

function question(query, psw) {
    return new Promise(res => {
        rl.stdoutMuted = psw;
        rl.query = query;
        rl.question(query, ans => {
            res(ans);
            rl.stdoutMuted = !psw;
            if (psw)
                console.log();
        });
    });
}

rl._writeToOutput = function _writeToOutput(stringToWrite) {
    if (rl.stdoutMuted)
      rl.output.write("\x1B[2K\x1B[200D"+rl.query+"["+((rl.line.length%2==1)?"=-":"-=")+"]");
    else
      rl.output.write(stringToWrite);
  };

try {
    const csrfReq = await fetch("https://www.mynelson.com/api/auth/csrf", {
        headers: {
            'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36`
        }
    });
    const csrfRev = await csrfReq.json();
    csrfToken = csrfRev.csrfToken;
}
catch (er) {
    console.error('Nelson server not available, try again?');
    process.exit(1);
}

async function authorize() {
    username = await question('username: ');
    password = await question('password: ', true);

    const body = new FormData();
    body.set("redirect", false);
    body.set("username", username);
    body.set("password", password);
    body.set("csrfToken", csrfToken);
    body.set("json", true);
    console.log(username, password, csrfToken)
    const resp = await fetch("https://www.mynelson.com/api/auth/callback/nedces?", {
        method: "POST",
        headers: {
            'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36`
        },
        body: new URLSearchParams({
            'redirect': true,
            'username': '',
            'password': password,
            'csrfToken': csrfToken,
            'callbackUrl': "https://www.mynelson.com/?callbackUrl=https%3A%2F%2Fwww.mynelson.com%2Fdashboard",
            'json': true
        })
    });
    console.log(resp.status);
    if (!resp.ok) 
        throw new Error(resp.status === 401 ? "Server returned 'Incorrect credentials'." : "Login failed due to error.")
    console.log(await resp.text());
    jar = resp.headers.get('set-cookie');
}

while (true) {
    try {
        await authorize();
        break;
    }
    catch (e) {
        console.error(e.message);
    }
}

const session = await fetch('https://www.mynelson.com/api/auth/session', {
    headers: {
        cookie: jar
    }
});
const data = await session.text();
console.log(data);