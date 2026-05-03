#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const auth = require('@collabnotes/shared-auth');
const notes = require('@collabnotes/shared-notes');
const sharing = require('@collabnotes/shared-sharing');

const SESSION_FILE = path.join(process.cwd(), '.collabnotes-session');
const HISTORY_FILE = path.join(process.cwd(), '.collabnotes-cli-history');
const recentNoteIds = [];

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  const content = fs.readFileSync(HISTORY_FILE, 'utf8');
  return content.split('\n').filter(Boolean).slice(-200);
}

function saveHistory(history) {
  const lines = (history || []).filter(Boolean).slice(0, 200).reverse();
  fs.writeFileSync(HISTORY_FILE, `${lines.join('\n')}\n`, 'utf8');
}

function registerNoteId(id) {
  if (!Number.isInteger(id) || id <= 0) return;
  const index = recentNoteIds.indexOf(String(id));
  if (index >= 0) recentNoteIds.splice(index, 1);
  recentNoteIds.unshift(String(id));
  if (recentNoteIds.length > 20) recentNoteIds.pop();
}

function completer(line) {
  const defaults = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const choices = defaults.concat(recentNoteIds);
  const hits = choices.filter((item) => item.startsWith(line));
  return [hits.length ? hits : choices, line];
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  history: loadHistory(),
  completer,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

async function withLoading(message, task) {
  const frames = ['-', '\\', '|', '/'];
  let index = 0;
  process.stdout.write(chalk.blue(`${frames[index]} ${message}`));
  const timer = setInterval(() => {
    index = (index + 1) % frames.length;
    process.stdout.write(`\r${chalk.blue(`${frames[index]} ${message}`)}`);
  }, 120);
  try {
    const result = await task();
    clearInterval(timer);
    process.stdout.write(`\r${chalk.green(`OK ${message}`)}\n`);
    return result;
  } catch (error) {
    clearInterval(timer);
    process.stdout.write(`\r${chalk.red(`ERR ${message}`)}\n`);
    throw error;
  }
}

function saveSession(token) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ token }), 'utf8');
}

function loadSessionToken() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.token || null;
  } catch (error) {
    return null;
  }
}

async function getCurrentUser() {
  const token = loadSessionToken();
  if (!token) return null;
  const user = await auth.verifyToken(token);
  return user || null;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    console.log(chalk.yellow('Please login first.'));
    return null;
  }
  return user;
}

async function login() {
  const username = await ask('Username: ');
  const password = await ask('Password: ');
  const result = await withLoading('Logging in', () => auth.login(username, password));
  if (!result.success) {
    console.log(chalk.red(`Login failed: ${result.error?.message || result.error || 'Unknown error'}`));
    return;
  }
  saveSession(result.data.token);
  console.log(chalk.green(`Logged in as ${result.data.user.username}`));
}

async function register() {
  const username = await ask('Username: ');
  const email = await ask('Email (optional): ');
  const password = await ask('Password: ');
  const result = await withLoading('Creating account', () =>
    auth.register(username, password, email || undefined)
  );
  if (!result.success) {
    console.log(chalk.red(`Register failed: ${result.error?.message || result.error || 'Unknown error'}`));
    return;
  }
  const loginResult = await auth.login(username, password);
  if (loginResult.success) {
    saveSession(loginResult.data.token);
  }
  console.log(chalk.green(`Registered user ${username}`));
}

async function listMyNotes() {
  const user = await requireUser();
  if (!user) return;
  const result = await withLoading('Loading your notes', () => notes.getUserNotes(user.id));
  if (!result.success) {
    console.log(chalk.red(`Could not list notes: ${result.error}`));
    return;
  }
  if (result.data.length === 0) {
    console.log(chalk.yellow('No notes found.'));
    return;
  }
  result.data.forEach((note) => {
    registerNoteId(note.id);
    console.log(chalk.blue(`#${note.id} ${note.title}`));
  });
}

async function createNote() {
  const user = await requireUser();
  if (!user) return;
  const title = await ask('Title: ');
  const content = await ask('Content: ');
  const tagsInput = await ask('Tags (comma separated): ');
  const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
  const result = await withLoading('Creating note', () => notes.createNote(user.id, title, content, tags));
  if (!result.success) {
    console.log(chalk.red(`Could not create note: ${result.error}`));
    return;
  }
  registerNoteId(result.data.id);
  console.log(chalk.green(`Note created with id ${result.data.id}`));
}

async function viewNote() {
  const user = await requireUser();
  if (!user) return;
  const noteId = Number(await ask('Note ID: '));
  const result = await withLoading('Loading note', () => notes.getNoteById(noteId, user.id));
  if (!result.success) {
    console.log(chalk.red(`Could not view note: ${result.error}`));
    return;
  }
  registerNoteId(noteId);
  const note = result.data;
  console.log(chalk.blue(`\n#${note.id} ${note.title}\n${note.content || ''}`));
}

async function shareNote() {
  const user = await requireUser();
  if (!user) return;
  const noteId = Number(await ask('Note ID: '));
  if (!Number.isInteger(noteId) || noteId <= 0) {
    console.log(chalk.yellow('Invalid note ID.'));
    return;
  }
  const username = await ask('Target username or email: ');
  const permission = (await ask('Permission (read/write): ')).toLowerCase();
  if (permission !== 'read' && permission !== 'write') {
    console.log(chalk.yellow('Permission must be read or write.'));
    return;
  }
  const result = await withLoading('Sharing note', () =>
    sharing.shareNote(noteId, user.id, username, permission)
  );
  if (!result.success) {
    if (String(result.error || '').toLowerCase().includes('denied')) {
      console.log(chalk.yellow('Permission denied: only the note owner can share this note.'));
      return;
    }
    console.log(chalk.red(`Could not share note: ${result.error}`));
    return;
  }
  console.log(chalk.green(`Shared note #${noteId} with user #${result.data.userId} (${result.data.permission})`));
}

async function listNoteAccess() {
  const user = await requireUser();
  if (!user) return;
  const noteId = Number(await ask('Note ID: '));
  if (!Number.isInteger(noteId) || noteId <= 0) {
    console.log(chalk.yellow('Invalid note ID.'));
    return;
  }
  const result = await withLoading('Loading access list', () => sharing.getNoteAccessList(noteId, user.id));
  if (!result.success) {
    if (String(result.error || '').toLowerCase().includes('denied')) {
      console.log(chalk.yellow('Permission denied: only the note owner can list access.'));
      return;
    }
    console.log(chalk.red(`Could not load access list: ${result.error}`));
    return;
  }
  if (!result.data.length) {
    console.log(chalk.yellow('No shared users for this note.'));
    return;
  }
  result.data.forEach((entry) => {
    const label = entry.username || entry.email || `user-${entry.user_id}`;
    console.log(chalk.blue(`- ${label} (id: ${entry.user_id}) -> ${entry.permission}`));
  });
}

async function revokeAccess() {
  const user = await requireUser();
  if (!user) return;
  const noteId = Number(await ask('Note ID: '));
  const targetUserId = Number(await ask('Target user ID to revoke: '));
  if (!Number.isInteger(noteId) || noteId <= 0 || !Number.isInteger(targetUserId) || targetUserId <= 0) {
    console.log(chalk.yellow('Invalid input. Note ID and User ID must be positive numbers.'));
    return;
  }
  const result = await withLoading('Revoking access', () => sharing.revokeAccess(noteId, user.id, targetUserId));
  if (!result.success) {
    if (String(result.error || '').toLowerCase().includes('denied')) {
      console.log(chalk.yellow('Permission denied: only the note owner can revoke access.'));
      return;
    }
    console.log(chalk.red(`Could not revoke access: ${result.error}`));
    return;
  }
  console.log(chalk.green(`Access revoked for user #${targetUserId} on note #${noteId}.`));
}

async function listSharedNotes() {
  const user = await requireUser();
  if (!user) return;
  const result = await withLoading('Loading shared notes', () => sharing.getNotesSharedWithUser(user.id));
  if (!result.success) {
    console.log(chalk.red(`Could not load shared notes: ${result.error}`));
    return;
  }
  if (!result.data.length) {
    console.log(chalk.yellow('No notes shared with you.'));
    return;
  }
  result.data.forEach((note) => {
    registerNoteId(note.id);
    console.log(chalk.blue(`#${note.id} ${note.title} (${note.permission})`));
  });
}

async function viewNotifications() {
  const user = await requireUser();
  if (!user) return;
  const result = await withLoading('Loading notifications', () => sharing.getNotifications(user.id));
  if (!result.success) {
    console.log(chalk.red(`Could not load notifications: ${result.error}`));
    return;
  }
  if (!result.data.length) {
    console.log(chalk.yellow('No notifications.'));
    return;
  }
  result.data.forEach((item) => {
    const status = item.read ? chalk.gray('read') : chalk.green('unread');
    console.log(chalk.blue(`#${item.id} [${item.type}] ${status}`));
  });
  const toMark = Number(await ask('Notification ID to mark as read (0 to skip): '));
  if (toMark > 0) {
    const mark = await sharing.markAsRead(toMark, user.id);
    if (mark.success) console.log(chalk.green(`Notification #${toMark} marked as read.`));
    else console.log(chalk.red(`Unable to mark as read: ${mark.error}`));
  }
}

function showMenu() {
  console.log(chalk.blue('\n=== CollabNotes CLI ==='));
  console.log(chalk.blue('1. Login'));
  console.log(chalk.blue('2. Register'));
  console.log(chalk.blue('3. List my notes'));
  console.log(chalk.blue('4. Create note'));
  console.log(chalk.blue('5. View note (by ID)'));
  console.log(chalk.blue('6. Share note (by ID, username, permission)'));
  console.log(chalk.blue('7. List who has access to a note'));
  console.log(chalk.blue('8. Revoke access'));
  console.log(chalk.blue('9. View notes shared with me'));
  console.log(chalk.blue('10. View notifications'));
  console.log(chalk.blue('11. Exit'));
}

async function main() {
  let running = true;
  while (running) {
    showMenu();
    const choice = await ask('Choose an option: ');

    switch (choice) {
      case '1':
        await login();
        break;
      case '2':
        await register();
        break;
      case '3':
        await listMyNotes();
        break;
      case '4':
        await createNote();
        break;
      case '5':
        await viewNote();
        break;
      case '6':
        await shareNote();
        break;
      case '7':
        await listNoteAccess();
        break;
      case '8':
        await revokeAccess();
        break;
      case '9':
        await listSharedNotes();
        break;
      case '10':
        await viewNotifications();
        break;
      case '11':
        running = false;
        break;
      default:
        console.log(chalk.yellow('Invalid option. Please choose from 1 to 11.'));
    }
  }

  saveHistory(rl.history);
  rl.close();
}

main().catch((error) => {
  console.error(chalk.red(`CLI failed: ${error.message}`));
  saveHistory(rl.history);
  rl.close();
});
