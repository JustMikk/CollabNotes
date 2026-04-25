#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const auth = require('@collabnotes/shared-auth');
const notes = require('@collabnotes/shared-notes');
const sharing = require('@collabnotes/shared-sharing');

const SESSION_FILE = path.join(process.cwd(), '.collabnotes-session');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
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
    console.log('Please login first.');
    return null;
  }
  return user;
}

async function login() {
  const username = await ask('Username: ');
  const password = await ask('Password: ');
  const result = await auth.login(username, password);
  if (!result.success) {
    console.log(`Login failed: ${result.error?.message || result.error || 'Unknown error'}`);
    return;
  }
  saveSession(result.data.token);
  console.log(`Logged in as ${result.data.user.username}`);
}

async function register() {
  const username = await ask('Username: ');
  const email = await ask('Email (optional): ');
  const password = await ask('Password: ');
  const result = await auth.register(username, password, email || undefined);
  if (!result.success) {
    console.log(`Register failed: ${result.error?.message || result.error || 'Unknown error'}`);
    return;
  }
  const loginResult = await auth.login(username, password);
  if (loginResult.success) {
    saveSession(loginResult.data.token);
  }
  console.log(`Registered user ${username}`);
}

async function listMyNotes() {
  const user = await requireUser();
  if (!user) return;
  const result = await notes.getUserNotes(user.id);
  if (!result.success) {
    console.log(`Could not list notes: ${result.error}`);
    return;
  }
  if (result.data.length === 0) {
    console.log('No notes found.');
    return;
  }
  result.data.forEach((note) => {
    console.log(`#${note.id} ${note.title}`);
  });
}

async function createNote() {
  const user = await requireUser();
  if (!user) return;
  const title = await ask('Title: ');
  const content = await ask('Content: ');
  const tagsInput = await ask('Tags (comma separated): ');
  const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
  const result = await notes.createNote(user.id, title, content, tags);
  if (!result.success) {
    console.log(`Could not create note: ${result.error}`);
    return;
  }
  console.log(`Note created with id ${result.data.id}`);
}

async function viewNote() {
  const user = await requireUser();
  if (!user) return;
  const noteId = Number(await ask('Note ID: '));
  const result = await notes.getNoteById(noteId, user.id);
  if (!result.success) {
    console.log(`Could not view note: ${result.error}`);
    return;
  }
  const note = result.data;
  console.log(`\n#${note.id} ${note.title}\n${note.content || ''}`);
}

async function shareNote() {
  const user = await requireUser();
  if (!user) return;
  const noteId = Number(await ask('Note ID: '));
  if (!Number.isInteger(noteId) || noteId <= 0) {
    console.log('Invalid note ID.');
    return;
  }
  const username = await ask('Target username or email: ');
  const permission = (await ask('Permission (read/write): ')).toLowerCase();
  if (permission !== 'read' && permission !== 'write') {
    console.log('Permission must be read or write.');
    return;
  }
  const result = await sharing.shareNote(noteId, user.id, username, permission);
  if (!result.success) {
    if (String(result.error || '').toLowerCase().includes('denied')) {
      console.log('Permission denied: only the note owner can share this note.');
      return;
    }
    console.log(`Could not share note: ${result.error}`);
    return;
  }
  console.log(`Shared note #${noteId} with user #${result.data.userId} (${result.data.permission})`);
}

async function listSharedNotes() {
  const user = await requireUser();
  if (!user) return;
  const result = await sharing.getNotesSharedWithUser(user.id);
  if (!result.success) {
    console.log(`Could not load shared notes: ${result.error}`);
    return;
  }
  if (!result.data.length) {
    console.log('No notes shared with you.');
    return;
  }
  result.data.forEach((note) => {
    console.log(`#${note.id} ${note.title} (${note.permission})`);
  });
}

function showMenu() {
  console.log('\n=== CollabNotes CLI ===');
  console.log('1. Login');
  console.log('2. Register');
  console.log('3. List my notes');
  console.log('4. Create note');
  console.log('5. View note (by ID)');
  console.log('6. Share note (by ID, username, permission)');
  console.log('7. List shared notes');
  console.log('8. Exit');
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
        await listSharedNotes();
        break;
      case '8':
        running = false;
        break;
      default:
        console.log('Invalid option. Please choose from 1 to 8.');
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error('CLI failed:', error.message);
  rl.close();
});
