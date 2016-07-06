'use strict';

const mysql = require('mysql');
const q = require('q');
const async = require('async-q');

const DATABASE_NAME = 'sysfisio';

const connection = mysql.createConnection(`mysql://root:amigen@localhost/${DATABASE_NAME}`);

function mysqlQuery(sql, ...params) {
  return q.ninvoke(connection, 'query', sql, ...params);
}

function getDatabaseInfo() {
  const sql = `SELECT
    t.table_schema AS db_name,
    t.table_name,
    (case
        when t.table_type = 'BASE TABLE' then 'table'
        when t.table_type = 'VIEW' then 'view'
        else t.table_type
        end) as table_type,
    c.column_name,
    c.column_type,
    c.column_default,
    c.column_key,
    c.is_nullable,
    c.extra,
    c.column_comment
FROM
    information_schema.tables AS t
    INNER JOIN information_schema.columns AS c ON t.table_name = c.table_name
        AND t.table_schema = c.table_schema
WHERE
    t.table_type in('base table', 'view')
    AND t.table_schema = '${DATABASE_NAME}'
ORDER BY
    t.table_schema,
    t.table_name,
    c.ordinal_position`;

  return mysqlQuery(sql)
    .spread((data) => data);
}

function groupTables(concat, row) {
  const tableData = concat[row.table_name];
  if (tableData) {
    tableData.push(row);
  } else {
    concat[row.table_name] = [row];
  }

  return concat;
}

function map(object, func) {
  const newObj = {};
  Object.keys(object)
    .sort()
    .forEach((key) => {
      newObj[key] = func(key, object[key]);
    });
  return newObj;
}

function concatRenderedRows(concat, rowData) {
  const checkIfEquals = (value, equals) => (((new RegExp(`${equals}`, 'ig')).test(value)) ? 'X' : '');
  const type = rowData.column_type.match(/^\w+/)[0].toUpperCase();
  const size = rowData.column_type.match(/\((\d+)\)$/);
  const domain = rowData.column_type.match(/\((\D+)\)$/);
  return `${concat}\n<tr>
  <td>${rowData.column_name}</td>
  <td>${type}</td>
  <td>${size ? size[1] : ''}</td>
  <td>${domain ? domain[1] : ''  }</td>
  <td>${checkIfEquals(rowData.extra, 'AUTO_INCREMENT')}</td>
  <td>${checkIfEquals(rowData.is_nullable, 'NO')}</td>
  <td>${checkIfEquals(rowData.column_key, 'PRI')}</td>
  <td>${checkIfEquals(rowData.column_key, 'MUL')}</td>
</tr>
`;
}

function renderTableRow(tableRowData) {
  return tableRowData.reduce(concatRenderedRows, '');
}

function renderTable(key, tableData) {
  const table = `<table>
  <thead>
    <tr>
      <th colspan="8">${key}</th>
    </tr>
    <tr>
      <th>Atributo</th>
      <th>Tipo</th>
      <th>Tamanho</th>
      <th>Domínio</th>
      <th>AI</th>
      <th>NN</th>
      <th>PK</th>
      <th>FK</th>
    </tr>
  </thead>
  <tbody>
    ${renderTableRow(tableData)}
  </tbody>
</table>`;

  return table;
}

function renderTables(data) {
  const tables = data.reduce(groupTables, {});
  const renderedTables = map(tables, renderTable);
  const concatenatedTables = [];
  map(renderedTables, (key, value) => concatenatedTables.push(value));
  return concatenatedTables.join('\n');
}

function render(data) {
  const html = `<!DOCTYPE html>
<html>
  <header>
    <style>
      table {
          border-collapse: collapse;
          margin-bottom: 10px;
      }

      th,td {
          border: 1px solid black;
          padding: 10px;
      }

      th {
          background: lightblue;
      }

      body {
          font-family: Arial, sans-serif;
      }
    </style>
  </header>
  <body>
    ${renderTables(data)}
  </body>
</html>`;
  return html;
}

function run() {
  return getDatabaseInfo()
    .then(render)
    .then((data) => process.stdout.write(`${data}\n`))
    .then(() => connection.end());
}

run().done();