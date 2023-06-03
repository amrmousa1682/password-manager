#!/usr/bin/env node
import chalk from "chalk";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import inquirer from "inquirer";
import { readFileSync, writeFileSync } from "fs";
import CryptoJS from "crypto-js";
import clipboardy from "clipboardy";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const displayHeader = async () => {
  console.clear();
  const headerAnimation = chalkAnimation.karaoke(
    chalk.red(
      figlet.textSync("loading...", {
        horizontalLayout: "full",
        font: "ANSI Shadow",
      })
    )
  );

  await sleep(4000);
  headerAnimation.stop();
  console.clear();
  console.log(
    chalk.bold.blue(
      figlet.textSync("Password Manager", {
        horizontalLayout: "full",
        font: "ANSI Shadow",
      })
    )
  );
};

const displayMenu = async () => {
  const menu = await inquirer.prompt([
    {
      type: "list",
      name: "menu",
      message: chalk.blue("What would you like to do?"),
      choices: [
        "Add new password",
        "Search for password",
        "Delete password",
        "Exit",
      ],
    },
  ]);
  return menu.menu;
};

const getMasterPassword = async (message) => {
  const masterPassword = await inquirer.prompt([
    {
      type: "password",
      name: "masterPassword",
      message: chalk.blue(message),
      mask: "*",
      validate: (input) => {
        if (
          !input.match("^(?=.*[a-zA-z])(?=.*[0-9])(?=.*[!@#$%^&*()_+]).{8,}$")
        ) {
          return chalk.red(
            "Password must be at least 8 characters long and contain at least one letter, one number and one special character."
          );
        }
        return true;
      },
    },
  ]);
  return masterPassword.masterPassword;
};

const addPassword = async (masterPassword) => {
  const passwords = JSON.parse(
    CryptoJS.AES.decrypt(
      readFileSync("./passwords", "utf-8"),
      masterPassword
    ).toString(CryptoJS.enc.Utf8)
  );

  const passwordTag = await inquirer.prompt([
    {
      type: "input",
      name: "passwordTag",
      message: chalk.blue("Enter the password tag:"),
      validate: (input) => {
        if (!input.match("^[a-zA-Z0-9]+$")) {
          return chalk.red("Password tag must be alphanumeric.");
        }
        for (let i = 0; i < passwords.length; i++) {
          if (passwords[i].passwordTag === input) {
            return chalk.red("Password tag already exists!");
          }
        }
        return true;
      },
    },
  ]);

  const choice = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: chalk.blue(
        "Do you want to generate a password or enter your own?"
      ),
      choices: ["Generate password", "Enter my own"],
    },
  ]);

  let password;
  if (choice.choice === "Generate password") {
    const length = Math.floor(Math.random() * (26 - 16) + 16);
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
    password = "";
    for (let i = 0; i < length; i++) {
      password += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
  } else {
    const passwordInput = await inquirer.prompt([
      {
        type: "password",
        name: "password",
        message: chalk.blue("Enter your password:"),
        mask: "*",
        validate: (input) => {
          if (input.length === 0) {
            return chalk.red("Password cannot be empty!");
          }
          return true;
        },
      },
    ]);
    password = passwordInput.password;
  }

  const newPassword = {
    passwordTag: passwordTag.passwordTag,
    password: CryptoJS.AES.encrypt(password, masterPassword).toString(),
  };
  passwords.push(newPassword);

  const encryptedData = CryptoJS.AES.encrypt(
    JSON.stringify(passwords),
    masterPassword
  ).toString();
  writeFileSync("./passwords", encryptedData);
  console.log(chalk.green("Password added successfully!"));
};

const searchPassword = async (masterPassword) => {
  const passwords = JSON.parse(
    CryptoJS.AES.decrypt(
      readFileSync("./passwords", "utf-8"),
      masterPassword
    ).toString(CryptoJS.enc.Utf8)
  );

  const passwordTag = await inquirer.prompt([
    {
      type: "input",
      name: "passwordTag",
      message: chalk.blue("Enter the password tag:"),
      validate: (input) => {
        if (!input.match("^[a-zA-Z0-9]+$")) {
          return chalk.red("Password tag must be alphanumeric.");
        }
        return true;
      },
    },
  ]);

  for (let i = 0; i < passwords.length; i++) {
    if (passwords[i].passwordTag === passwordTag.passwordTag) {
      const password = CryptoJS.AES.decrypt(
        passwords[i].password,
        masterPassword
      ).toString(CryptoJS.enc.Utf8);
      clipboardy.writeSync(password);
      console.log(chalk.green("Password copied to clipboard!"));
      const answer = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: chalk.blue("Do you want to see the password?"),
        },
      ]);

      if (answer.confirm) {
        console.log(chalk.green(password));
      }
      return;
    }
  }
  console.log(chalk.red("Password tag not found!"));
};

const deletePassword = async (masterPassword) => {
  const passwords = JSON.parse(
    CryptoJS.AES.decrypt(
      readFileSync("./passwords", "utf-8"),
      masterPassword
    ).toString(CryptoJS.enc.Utf8)
  );

  const passwordTag = await inquirer.prompt([
    {
      type: "input",
      name: "passwordTag",
      message: chalk.blue("Enter the password tag:"),
      validate: (input) => {
        if (!input.match("^[a-zA-Z0-9]+$")) {
          return chalk.red("Password tag must be alphanumeric.");
        }
        return true;
      },
    },
  ]);

  for (let i = 0; i < passwords.length; i++) {
    if (passwords[i].passwordTag === passwordTag.passwordTag) {
      passwords.splice(i, 1);
      const encryptedData = CryptoJS.AES.encrypt(
        JSON.stringify(passwords),
        masterPassword
      ).toString();
      writeFileSync("./passwords", encryptedData);
      console.log(chalk.green("Password deleted successfully!"));
      return;
    }
  }
  console.log(chalk.red("Password tag not found!"));
};

const main = async () => {
  await displayHeader();
  const masterPassword = await getMasterPassword("Enter your master password:");
  try {
    const content = readFileSync("./passwords", "utf-8");
    if (content.length === 0) {
      throw new Error();
    }
  } catch (err) {
    const encryptedData = CryptoJS.AES.encrypt("[]", masterPassword).toString();
    writeFileSync("./passwords", encryptedData);
  }
  while (true) {
    const choice = await displayMenu();
    switch (choice) {
      case "Add new password":
        await addPassword(masterPassword);
        break;
      case "Search for password":
        await searchPassword(masterPassword);
        break;
      case "Delete password":
        await deletePassword(masterPassword);
        break;
      case "Exit":
        process.exit(0);
    }
  }
};

main();
