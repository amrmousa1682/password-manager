#!/usr/bin/env node
import chalk from "chalk";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import inquirer from "inquirer";
import { readFileSync, writeFileSync, existsSync } from "fs";
import CryptoJS from "crypto-js";
import clipboardy from "clipboardy";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PASSWORDS_FILE = "./passwords";
const FILE_ENCODING = "utf-8";
const MenuChoice = {
  ADD_NEW_PASSWORD: "Add new password",
  SEARCH_FOR_PASSWORD: "Search for password",
  DELETE_PASSWORD: "Delete password",
  EXIT: "Exit",
};
const PasswordChoice = {
  GENERATE_PASSWORD: "Generate password",
  ENTER_PASSWORD: "Enter password",
};

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

const getMenuChoice = async () => {
  const menuInput = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: chalk.blue("What would you like to do?"),
      choices: Object.values(MenuChoice),
    },
  ]);
  return menuInput.choice;
};

const getPassword = async (message) => {
  const { password } = await inquirer.prompt([
    {
      type: "password",
      name: "password",
      message: chalk.blue(message),
      mask: "*",
      validate: (input) => {
        if (!input.match("^(?=.*[a-zA-z])(?=.*[0-9])(?=.*[!@#$%^&*()_+]).{8,}$")) {
          return chalk.red(
            "Password must be at least 8 characters long and contain at least one letter, one number and one special character."
          );
        }
        return true;
      },
    },
  ]);
  return password;
};

const getPasswordTag = async () => {
  const { passwordTag } = await inquirer.prompt([
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
  return passwordTag;
};

const getPasswordOption = async () => {
  const { choice } = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: chalk.blue("Do you want to generate a password or enter your own?"),
      choices: Object.values(PasswordChoice),
    },
  ]);
  return choice;
};
const getConfirm = async (message) => {
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.blue(message),
    },
  ]);
  return confirm;
};
const generatePassword = () => {
  const length = Math.floor(Math.random() * (26 - 16) + 16);
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return password;
};

const encryptPasswords = (passwords, masterPassword) => {
  const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(passwords), masterPassword).toString();
  writeFileSync(PASSWORDS_FILE, encryptedData);
};
const decryptPasswords = (masterPassword) => {
  const passwords = JSON.parse(
    CryptoJS.AES.decrypt(readFileSync(PASSWORDS_FILE, FILE_ENCODING), masterPassword).toString(
      CryptoJS.enc.Utf8
    )
  );
  return passwords;
};
const addPassword = async (masterPassword) => {
  const passwords = decryptPasswords(masterPassword);

  const passwordTag = await getPasswordTag();
  const index = passwords.findIndex((password) => password.passwordTag === passwordTag);

  if (index !== -1) {
    if (await getConfirm("Password tag already exists. Do you want to overwrite it?")) {
      passwords.splice(index, 1);
    } else {
      console.log(chalk.red("Password not added."));
      return;
    }
  }

  const choice = await getPasswordOption();

  let password;
  if (choice === PasswordChoice.GENERATE_PASSWORD) {
    password = generatePassword();
  } else {
    password = await getPassword("Enter your password:");
  }

  const newPassword = {
    passwordTag,
    password: CryptoJS.AES.encrypt(password, masterPassword).toString(),
  };
  passwords.push(newPassword);
  encryptPasswords(passwords, masterPassword);

  console.log(chalk.green("Password added successfully!"));
};

const searchPassword = async (masterPassword) => {
  const passwords = decryptPasswords(masterPassword);

  const passwordTag = await getPasswordTag();

  const index = passwords.findIndex((password) => password.passwordTag === passwordTag);

  if (index !== -1) {
    if (await getConfirm("Do you want to copy the password to clipboard?")) {
      clipboardy.writeSync(
        CryptoJS.AES.decrypt(passwords[index].password, masterPassword).toString(CryptoJS.enc.Utf8)
      );
      console.log(chalk.green("Password copied to clipboard!"));
    } else {
      console.log(
        chalk.green(
          CryptoJS.AES.decrypt(passwords[index].password, masterPassword).toString(
            CryptoJS.enc.Utf8
          )
        )
      );
    }
    return;
  }
  console.log(chalk.red("Password tag not found!"));
};

const deletePassword = async (masterPassword) => {
  const passwords = decryptPasswords(masterPassword);

  const passwordTag = await getPasswordTag();

  const index = passwords.findIndex((password) => password.passwordTag === passwordTag);

  if (index !== -1) {
    passwords.splice(index, 1);
    encryptPasswords(passwords, masterPassword);
    console.log(chalk.green("Password deleted successfully!"));
    return;
  }

  console.log(chalk.red("Password tag not found!"));
};

const createNewMasterPassword = async () => {
  let masterPassword, repeatMasterPassword;

  do {
    masterPassword = await getPassword("Create master password:");
    repeatMasterPassword = await getPassword("Repeat the master password:");

    if (masterPassword !== repeatMasterPassword) {
      console.log(chalk.red("Passwords do not match. Please try again."));
    }
  } while (masterPassword !== repeatMasterPassword);

  console.log(chalk.green("Master password set successfully."));
  return masterPassword;
};

const isMasterPasswordCorrect = (masterPassword, content) => {
  try {
    decryptPasswords(masterPassword);
    console.log(chalk.green("Master password is correct."));
    return true;
  } catch (error) {
    console.log(chalk.red("Master password incorrect or file corrupted."));
    return false;
  }
};

const main = async () => {
  await displayHeader();
  if (!existsSync(PASSWORDS_FILE)) {
    console.log(chalk.yellow("Welcome to password manager setup."));
    const masterPassword = await createNewMasterPassword();
    encryptPasswords([], masterPassword);
    console.log(chalk.green("Password manager setup complete."));
  }

  let masterPassword;
  do {
    masterPassword = await getPassword("Enter your master password:");
  } while (!isMasterPasswordCorrect(masterPassword, readFileSync(PASSWORDS_FILE, FILE_ENCODING)));

  while (true) {
    const choice = await getMenuChoice();
    switch (choice) {
      case MenuChoice.ADD_NEW_PASSWORD:
        await addPassword(masterPassword);
        break;
      case MenuChoice.SEARCH_FOR_PASSWORD:
        await searchPassword(masterPassword);
        break;
      case MenuChoice.DELETE_PASSWORD:
        await deletePassword(masterPassword);
        break;
      case MenuChoice.EXIT:
        console.log(chalk.yellow("Exiting..."));
        process.exit(0);
    }
  }
};

main();
