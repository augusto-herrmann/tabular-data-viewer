/* eslint-disable @typescript-eslint/naming-convention */

// initialize vscode api
const vscode = acquireVsCodeApi();

// data document vars
let documentUrl = '';
let fileName = '';

// table view vars
let tableContainer, table;
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
    label: "<i class='fas fa-trash'></i> Delete Row",
    action: function (e, row) { row.delete(); }
  },
  {
    label: "Freeze Row",
    action: function (e, row) { row.freeze(); }
  }
];

const columnHeaderMenu = [
  {
    label: 'Hide Column',
    action: function (e, column) {
      column.hide();
    }
  },
];

// add page load handler
window.addEventListener('load', initializeView);

// redraw table on window resize
window.addEventListener('resize', function () {
  console.log('tableView.height:', window.innerHeight);
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
  console.log('tableView.height:', window.innerHeight);

  // notify webview
  vscode.postMessage({ command: 'refresh' });

  // wire data refresh
  const refreshButton = document.getElementById('refresh-button');
  refreshButton.addEventListener('click', onRefresh);
}

/**
 * Reloads webview data.
 * 
 * @see https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-an-extension-to-a-webview
 */
function onRefresh() {
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
        // type - type of data being persisted ("sort", "filter", "group", "page" or "columns")
        // data - array or object of data for the table options config
        const tableOptionKey = `${id}-${type}`;
        console.log(`tableOption:${tableOptionKey}`, data);
        localStorage.setItem(tableOptionKey, JSON.stringify(data));
      },
      persistenceReaderFunc: function (id, type) {
        let tableOptions = localStorage.getItem(`${id}-${type}`);
        console.log('tableOptions:', tableOptions);
        return tableOptions ? JSON.parse(tableOptions) : false;
      },
    });

    // add column context menus
    table.on('tableBuilt', function () {
      const columns = table.getColumns();
      console.log('tableView.columns:', columns);
      // addTableColumnHeaderMenuOptions(columns);
    });
  }
  else {
    // reload table data
    clearTable(table);
    addData(table, tableData);
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
 * Logs table data for debug.
 * 
 * @param tableData Loaded able data.
 */
function logTableData(tableData) {
  console.log('tabular.data.view:rowCount:', tableData.length);
  console.log('1st 10 rows:', tableData.slice(0, 10));
}


/**
 * Adds table column header context menu to the table columns after table load.
 * 
 * @param {*} columns Table columns.
 */
function getColumnHeaderMenuOptions(columns) {
  const menu = [];
  for (let column of columns) {

    // create checkbox element using font awesome icons
    let icon = document.createElement('i');
    icon.classList.add('fas');
    icon.classList.add(column.isVisible() ? 'fa-check-square' : 'fa-square');

    // build label
    let label = document.createElement('span');
    let title = document.createElement('span');
    title.textContent = " " + column.getDefinition().title;
    label.appendChild(icon);
    label.appendChild(title);

    // create menu item
    menu.push({
      label: label,
      action: function (e) {
        // prevent menu closing
        e.stopPropagation();

        //toggle current column visibility
        column.toggle();

        // change menu item icon
        if (column.isVisible()) {
          icon.classList.remove('fa-square');
          icon.classList.add('fa-check-square');
        }
        else {
          icon.classList.remove('fa-check-square');
          icon.classList.add('fa-square');
        }
      }
    });
    return menu;
  }
}
