import readline from 'node:readline/promises';
import fs from 'node:fs';

const rl = readline.createInterface(process.stdin, process.stdout);

let csrfToken;
let username;
let password;

try {
    const csrfReq = await fetch("https://www.mynelson.com/api/auth/csrf");
    const csrfRev = await csrfReq.json();
    csrfToken = csrfReq.csrfToken
}
catch (er) {
    console.error('Nelson server not available, try again?');
    process.exit(1)
}

username = await rl.question('username: ');
password = await rl.question('password: ');
console.log(ans)
