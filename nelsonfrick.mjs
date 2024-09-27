/*
https://github.com/dxataclub/nelsonfrick
*/

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'path';
import { mkdir } from "node:fs/promises";

const rl = readline.createInterface(process.stdin, process.stdout);

let csrfToken;
let jar;
let guid;
let products;
let target;

const reControlChars = /[\u0000-\u001F\u0080-\u009F]/g; 
const reRepeatedReservedCharacters = /([<>:"/\\|?*\u0000-\u001F]){2,}/g;
const reRelativePath = /^\.+(\\|\/)|^\.+$/;
const reTrailingPeriods = /\.+$/;

const MAX_FILENAME_LENGTH = 100;
const filenameReservedRegex = /[<>:"/\\|?*\u0000-\u001F]/g;;
const windowsReservedNameRegex = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Origin": "https://www.mynelson.com",
    "Referer": "https://www.mynelson.com/",
    "Sec-Ch-Ua": `"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"`,
    "Accept-Language": "en-US,en;q=0.9"
}

function setJar(req) {
    const raw = req.headers.getSetCookie();
    jar = raw.map((entry) => {
      const parts = entry.split(';');
      const cookiePart = parts[0];
      return cookiePart;
    }).join(';');
}

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

function progress(total, name) {
    const progressBarLength = 15;
    let progress = 0;
  
    function updateProgressBar() {
        const percentage = (progress / total) * 100;
        const progressBar = '='.repeat(Math.round((percentage / 100) * progressBarLength));
        const spaces = ' '.repeat(progressBarLength - progressBar.length);

        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`[${progressBar}${spaces}] ${percentage.toFixed(2)}% ${name}`);
    }
  
    function incrementProgress() {
        if (progress < total) {
            progress++;
            updateProgressBar();
        } else {
            completeProgressBar();
        }
    }
  
    function completeProgressBar() {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
    }
  
    return {
        update: updateProgressBar,
        increment: incrementProgress,
        complete: completeProgressBar,
    };
}

async function authorize() {
    let username = await question('email: ');
    let password = await question('password: ', true);

    const seq1 = await fetch("https://www.mynelson.com/api/auth/csrf", {
        headers: {
            'Cookie': jar,
            ...headers
        }
    });

    if (!seq1.ok)
        throw new Error("Login failed due to a response from Nelson.")

    if (!jar)
        setJar(seq1);    
    csrfToken = (await seq1.json()).csrfToken;

    const login = await fetch("https://www.mynelson.com/api/auth/callback/nedces?", {
        method: "POST",
        headers: {
            'Cookie': jar,
            ...headers
        },
        body: new URLSearchParams({
            'redirect': true,
            username,
            password,
            csrfToken,
            'callbackUrl': "https://www.mynelson.com/",
            'json': true
        })
    });

    if (!login.ok) 
        throw new Error(login.status === 401 ? "Nelson refused credentials." : "Login failed due to a response from Nelson, try again?")

    setJar(login);
}

function getContents(resources) {
    const targets = []

    for (let r in resources) {
        const resr = resources[r];
        
        if (resr.icon_display === 'link')
            continue;
        
        targets.push(resr);
    }

    return [targets];
}

function filenamify(string, options = {}) {
	if (typeof string !== 'string') {
		throw new TypeError('Expected a string');
	}

	const replacement = options.replacement === undefined ? '!' : options.replacement;

	if (filenameReservedRegex.test(replacement) && reControlChars.test(replacement)) {
		throw new Error('Replacement string cannot contain reserved filename characters');
	}

	if (replacement.length > 0) {
		string = string.replace(reRepeatedReservedCharacters, '$1');
	}

	string = string.normalize('NFD');
	string = string.replace(reRelativePath, replacement);
	string = string.replace(filenameReservedRegex, replacement);
	string = string.replace(reControlChars, replacement);
	string = string.replace(reTrailingPeriods, '');

	if (replacement.length > 0) {
		const startedWithDot = string[0] === '.';

		// We removed the whole filename
		if (!startedWithDot && string[0] === '.') {
			string = replacement + string;
		}

		// We removed the whole extension
		if (string[string.length - 1] === '.') {
			string += replacement;
		}
	}

	string = windowsReservedNameRegex.test(string) ? string + replacement : string;
	const allowedLength = typeof options.maxLength === 'number' ? options.maxLength : MAX_FILENAME_LENGTH;
	if (string.length > allowedLength) {
		const extensionIndex = string.lastIndexOf('.');
		if (extensionIndex === -1) {
			string = string.slice(0, allowedLength);
		} else {
			const filename = string.slice(0, extensionIndex);
			const extension = string.slice(extensionIndex);
			string = filename.slice(0, Math.max(1, allowedLength - extension.length)) + extension;
		}
	}

	return string;
}

async function downloadProd(targetId) {
    const isbn13 = products[targetId].isbn;

    const prodReq = await fetch('https://www.mynelson.com/api/getproduct', {
        method: "POST",
        headers: {
            ...headers,
            "Cookie": jar,
            "Content-Type": "text/plain;charset=UTF-8"
        },
        body: JSON.stringify({ guid, isbn13 })
    });

    const product = await prodReq.json();
    const diskLocation = product.reply.diskLocation
    const resources = product.resources;
    const downloads = products[targetId].title
    const server = `https://www.mynelson.com/resources/${diskLocation}/${isbn13}/student/`

    const [targets] = getContents(resources);
    const progressbr = progress(targets.length, products[targetId].title)

    if (!fs.existsSync(downloads))
        await mkdir(downloads);

    for (let r in targets) {
        const resr = targets[r];
        const res = await fetch(`${server}${resr.file_path}`, {
            headers: {
                ...headers,
                "Cookie": jar
            }
        });

        const pdf = await res.arrayBuffer();
        const destination = path.resolve(`./${downloads}`, filenamify(`${resr.title}.pdf`));
        console.log((destination));
        fs.writeFileSync(destination, Buffer.from(pdf));

        progressbr.increment();
    }
}

rl._writeToOutput = function _writeToOutput(stringToWrite) {
    if (rl.stdoutMuted)
      rl.output.write("\x1B[2K\x1B[200D"+rl.query+"["+((rl.line.length%2==1)?"=-":"-=")+"]");
    else
      rl.output.write(stringToWrite);
};

try {
    const prelight = await fetch("https://www.mynelson.com/api/auth/providers", {headers});
    if (!prelight.ok)
        throw new Error(await prelight.text());
}
catch (er) {
    console.error('Nelson server not available, try again?');
    process.exit(1);
}

console.log("Authenticate with mynelson.com")

while (true) {
    try {
        await authorize();
        break;
    }
    catch (e) {
        console.error(e.message);
    }
}

try {
    const sessReq = await fetch('https://www.mynelson.com/api/auth/session', {
        headers: {
            ...headers,
            "Cookie": jar
        }
    });
    guid = (await sessReq.json()).user.guid;
    
    const prodsReq = await fetch('https://www.mynelson.com/api/getcustomerproducts', {
        method: "POST",
        headers: {
            ...headers,
            "Cookie": jar,
            "Content-Type": "text/plain;charset=UTF-8"
        },
        body: JSON.stringify({ guid })
    });
    products = await prodsReq.json();
    
    if (Object.keys(products).length < 1) {
        console.log("No avilable products.");
        process.exit();
    }
}
catch (er) {
    console.log("Problem occured while reading Nelson.")
    process.exit(1);
}

console.log("\nAvailable products to pirate:")

let i = 0;
for (let p in products) {
    i++;
    console.log(`${i}. ${products[p].title} (ISBN: ${products[p].isbn})`)
}
i++;

console.log(`${i}. All products\n`)

while (true) {
    target = parseInt(await question(`Select product (1-${i}): `));

    if (target <= i && 0 < target) {
        target = Object.keys(products)[target - 1]
        rl.close();
        break;
    }

    console.log('??')
}

try {
    if (!target) {
        for (let p in products) {
            await downloadProd(p);
            console.log();
        }
    }
    else {
        await downloadProd(target);
    }
}
catch (er) {
    console.log(er)
    console.log("Problem occured while downloading product data.");
    process.exit(1);
}
