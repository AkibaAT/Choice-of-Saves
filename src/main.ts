import * as tmp from 'tmp';
import * as asar from 'asar';
import * as fs from 'fs';
import * as htmlParser from 'node-html-parser';
import { QMainWindow, QFileDialog, QWidget, QLabel, FlexLayout, FileMode, QPushButton, QIcon } from '@nodegui/nodegui';

const win = new QMainWindow();
win.setWindowTitle("ChoiceScript Savegame System Patcher");

const centralWidget = new QWidget();
centralWidget.setObjectName('root');
const rootLayout = new FlexLayout();
centralWidget.setLayout(rootLayout);

const label = new QLabel();
label.setObjectName('label');
label.setText('ChoiceScript Savegame System Patcher');

const fileDialog = new QFileDialog();
fileDialog.setFileMode(FileMode.AnyFile);
fileDialog.setNameFilter('ChoiceScript bundle (app.asar)');

const button = new QPushButton();
button.setObjectName('button');
button.setText('Add save system');
button.addEventListener('clicked', (checked) => onBtnClick());

rootLayout.addWidget(label);
rootLayout.addWidget(button);
win.setCentralWidget(centralWidget);
win.setStyleSheet(
  `
    #root {
      background-color: #000;
      height: '100%';
      align-items: 'center';
      justify-content: 'center';
    }
    #label {
      font-size: 20px;
      font-weight: bold;
      color: #FFF;
      padding: 10px;
    }
    #button {
      background-color: #FFF;
      padding: 10px;
    }
  `
);
win.show();

(global as any).win = win;

var onBtnClick = () => {
    fileDialog.exec();
    const selectedFiles: string[] = fileDialog.selectedFiles();
    const path: unknown = selectedFiles.pop();
    if (typeof path == 'string') {
        patchArchive(path);
    }
}

var patchArchive = (path: string) => {
    //const tempDirectory: tmp.DirResult = tmp.dirSync({ unsafeCleanup: true });
    const tempDirectory: tmp.DirResult = tmp.dirSync();

    // Extract the whole archive to the new temp directory
    asar.extractAll(path, tempDirectory.name);

    // Try to load index.html
    fs.readFile(tempDirectory.name + '/deploy/index.html', 'utf8', function (error: any, indexHtml: string) {
        if (error) {
            tempDirectory.removeCallback();
            return console.log(error);
        }

        // Blind copy JS to target
        fs.copyFileSync('./assets/ChoiceScriptSavePlugin.js', tempDirectory.name + '/deploy/ChoiceScriptSavePlugin.js');

        // Only patch if JS is not already being included
        if (!indexHtml.includes('ChoiceScriptSavePlugin.js')) {
            let domDocument: htmlParser.HTMLElement = htmlParser.parse(indexHtml);
            const scriptElements = domDocument.querySelectorAll('head script');
            scriptElements.every(function (scriptElement: htmlParser.HTMLElement) {
                const scriptSrc = scriptElement.getAttribute('src');
                if (typeof scriptSrc == 'string' && scriptSrc.includes('navigator.js')) {
                    scriptElement.insertAdjacentHTML('afterend', "\n" + '<script src="ChoiceScriptSavePlugin.js"></script>');
                    return false;
                }
                return true;
            });
            fs.writeFileSync(tempDirectory.name + '/deploy/index.html', domDocument.toString());
        }

        // Repackage archive
        asar.createPackage(tempDirectory.name, path)
            .then(function (newResult) {
                tempDirectory.removeCallback();
            })
            .catch(function (newResult) {
                tempDirectory.removeCallback();
            });
    });
 }
