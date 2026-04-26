const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');

const APP_URL = process.env.LAYCODE_APP_URL || 'http://localhost:3000/dashboard';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: 'LayCode',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(APP_URL).catch(() => {
    win.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(`
      <html>
        <body style="font-family: sans-serif; margin: 24px; line-height: 1.6;">
          <h2>LayCode Desktop 启动中</h2>
          <p>当前无法连接到 ${APP_URL}</p>
          <p>请确认服务已启动，然后按 Ctrl+R 刷新。</p>
        </body>
      </html>
    `));
  });
}

ipcMain.handle('laycode:pick-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择要导入的项目目录',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
