/* eslint-disable @typescript-eslint/naming-convention */

// initialize vscode api
const vscode = acquireVsCodeApi();

// data document vars
let documentUrl = '';
let fileName = '';
let saveDataFileName = '';

// table view vars
let tableContainer, table, progressRing, saveFileTypeSelector;
let tableColumns = [];
let tableData = [];

// table view settings
const toolbarHeight = 40; // table view toolbar height offset
const autoResize = true;
const autoColumns = true;
const enableClipboard = true; // enable clipboard copy and paste
const clipboardPasteAction = 'replace';
const movableColumns = true;
const movableRows = true;
const selectableRows =  true;
const reactiveData = true;
const renderVerticalBuffer = 300; // virtual view buffer height in px for redraw on scroll

// tabulator debug options
const debugInvalidOptions = true; // tabulator warnings

// Note: set these to true to log all events dispatched by the tabulator
const debugEventsExternal = ['tableBuilding', 'dataLoaded', 'tableBuilt'];
const debugEventsInternal = false; // log all internal tabulator events

// table row context menu options
const rowContextMenu = [
  {
    label: "Freeze Row",
    action: function (e, row) {
      row.freeze();
    }
  },
  {
    label: 'Delete Row',
    action: function (e, row) {
      row.delete();
    }
  },
];

const columnHeaderMenu = [
  {
    label: 'Hide Column',
    action: function (e, column) {
      column.hide();
    }
  },
  {
    label: "Freeze Column",
    action: function (e, column) {
      column.updateDefinition({ frozen: true });
    }
  },
  {
    label: 'Delete Column',
    action: function (e, column) {
      column.delete();
    }
  }
];

// add page load handler
window.addEventListener('load', initializeView);

// redraw table on window resize
window.addEventListener('resize', function () {
  // console.log('tableView.height:', window.innerHeight);
  if (table) {
    table.setHeight(window.innerHeight - toolbarHeight);
  }
});

// add data/config update handler
window.addEventListener('message', event => {
  switch (event.data.command) {
    case 'refresh':
      console.log('refreshing table view ...');
      documentUrl = event.data.documentUrl;
      fileName = event.data.fileName;
      vscode.setState({ documentUrl: documentUrl });
      tableData = event.data.tableData;
      loadData(tableData, fileName);
      break;
  }
});

/**
 * Initializes table webview.
 */
function initializeView() {
  // initialize table container
  tableContainer = document.getElementById('table-container');
  // console.log('tableView.height:', window.innerHeight);

  // data progress loading indicator
  progressRing = document.getElementById('progress-ring');

  // save file selector
  saveFileTypeSelector = document.getElementById('save-file-type-selector');
  saveFileTypeSelector.onchange = saveData;

  // reload data UI
  const reloadButton = document.getElementById('reload-button');
  reloadButton.addEventListener('click', reloadData);

  // notify webview
  vscode.postMessage({ command: 'refresh' });
}

/**
 * Reloads webview data.
 * 
 * @see https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-an-extension-to-a-webview
 */
function reloadData() {
  progressRing.style.visibility = 'visible';
  vscode.postMessage({
    command: 'refresh',
  });
}

/**
 * Loads and displays table data.
 * 
 * @param {*} tableData Data array to display in tabulator table.
 * @param {*} fileName Data file name for table config persistence and reload.
 */
function loadData(tableData, documentUrl) {
  logTableData(tableData);
  if (table === undefined) {
    table = new Tabulator('#table-container', {
      height: window.innerHeight - toolbarHeight,
      maxHeight: '100%',
      autoResize: autoResize,
      autoColumns: autoColumns,
      columnDefaults: {
        headerMenu: columnHeaderMenu
      },
      clipboard: enableClipboard, // enable clipboard copy and paste
      clipboardPasteAction: clipboardPasteAction,
      layout: 'fitDataStretch', // 'fitColumns',
      layoutColumnsOnNewData: true,
      movableColumns: movableColumns,
      movableRows: movableRows,
      selectable: selectableRows,
      reactiveData: reactiveData,
      data: tableData,
      rowContextMenu: rowContextMenu,
      renderVerticalBuffer: renderVerticalBuffer,
      debugInvalidOptions: debugInvalidOptions, // log invalid tabulator config warnings
      debugEventsExternal: debugEventsExternal,
      debugEventsInternal: debugEventsInternal,
      persistenceMode: 'local',
      persistenceID: fileName,
      persistentLayout: true,
      persistence: {
        sort: true,
        filter: true,
        group: true,
        columns: true,
      },
      persistenceWriterFunc: function (id, type, data) {
        // id - table config persistence id
        // type - type of table setting being persisted ("sort", "filter", "group", "page" or "columns")
        // data - array or object of data for the table options config
        const tableSettingKey = `${id}-${type}`;
        console.log(`tableSetting:${tableSettingKey}:`, data);
        localStorage.setItem(tableSettingKey, JSON.stringify(data));
      },
      persistenceReaderFunc: function (id, type) {
        const tableSettingKey = `${id}-${type}`;
        const tableSettings = localStorage.getItem(tableSettingKey);
        if (tableSettings) {
          console.log(`tableSetting:${tableSettingKey}:`, tableSettings);
        }
        return tableSettings ? JSON.parse(tableSettings) : false;
      },
      downloadReady: function (fileContents, blob) {
        // fileContents - unencoded contents of the file to save
        // blob - blob object for data file download/save
        // console.log(fileContents);

        // request data file save
        vscode.postMessage({
          command: 'saveData',
          data: fileContents,
          dataFileType: saveFileTypeSelector.value,
          dataFileName: saveDataFileName
        });

        // Note: this must return a blob to proceed with the download in a browser,
        // or false to abort download and handle it in table view extension with workspace.fs
        return false; // blob; 
      }
    });

    // add column context menus
    table.on('tableBuilt', function () {
      progressRing.style.visibility = 'hidden';
      const columns = table.getColumns();
      console.log('tableView.columns:', columns);
    });
  }
  else {
    // reload table data
    clearTable(table);
    addData(table, tableData);
    progressRing.style.visibility = 'hidden';
  }
}

/**
 * Removes all table data.
 */
function clearTable(table) {
  if (table) {
    table.clearData();  
  }
}

/**
 * Adds data to the table.
 * 
 * @param {*} table Tabulator table instance.
 * @param {*} tableData Data array for the table rows.
 */
function addData(table, tableData) {
  if (table && tableData) {
    table.addData(tableData, true)
      .then(function (rows) { //rows - array of the row components for the rows updated or added
      })
      .catch(function (error) {
        // handle error updating data
        console.error(error);
      });
  }
}

/**
 * Saves table data as CSV or JSON for now.
 */
function saveData() {
  const dataFileType = saveFileTypeSelector.value;
  const dataFileName = fileName.substring(0, fileName.lastIndexOf('.') + 1);
  saveDataFileName = dataFileName + dataFileType;
  console.log('tabView:saveData(): saving data:', saveDataFileName);
  table.download(dataFileType, saveDataFileName);
}

/**
 * Logs table data for debug.
 * 
 * @param tableData Loaded able data.
 */
function logTableData(tableData) {
  console.log('tabular.data.view:rowCount:', tableData.length);
  console.log('1st 10 rows:', tableData.slice(0, 10));
}
