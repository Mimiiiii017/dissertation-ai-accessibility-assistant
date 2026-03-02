# Tables: Data Tables and Headers

## Tags
Tags: #tables #data-tables #semantic-html #wcag #1.3.1

## Purpose
Ensure data tables are structured so users of assistive technologies can understand relationships between headers and data cells.

## Key points
- Tables must be used only for tabular data, not layout.
- Header cells must be identified using `<th>`.
- Relationships between headers and data cells must be programmatically defined.
- Simple tables can rely on proper `<th>` placement.
- Complex tables may require additional attributes to clarify associations.

## Developer checks
- Confirm tables are used for data, not visual layout.
- Check that column and row headers use `<th>` instead of `<td>`.
- Verify headers are correctly scoped to rows or columns.
- Ensure table captions are present when context is needed.
- Test table navigation with a screen reader to confirm header announcements.

## Fix patterns
- Replace layout tables with CSS-based layouts.
- Convert header cells from `<td>` to `<th>`.
- Add `scope="col"` or `scope="row"` to header cells.
- Include a `<caption>` to describe the table’s purpose.
- Simplify overly complex tables where possible.

## Examples
```html
<!-- Simple data table -->
<table>
  <caption>Monthly sales figures</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Sales</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">January</th>
      <td>€10,000</td>
    </tr>
    <tr>
      <th scope="row">February</th>
      <td>€12,500</td>
    </tr>
  </tbody>
</table>

<!-- Incorrect (layout table – not recommended) -->
<table>
  <tr>
    <td>Sidebar</td>
    <td>Main content</td>
  </tr>
</table>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Simple data table
function SalesTable({ data }) {
  return (
    <table>
      <caption>Monthly sales figures</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Sales</th>
          <th scope="col">Target</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            <th scope="row">{row.month}</th>
            <td>{row.sales}</td>
            <td>{row.target}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Complex table with sorting
import { useState } from 'react';

function AccessibleTable({ data }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  
  const handleSort = (key) => {
    setSortKey(key);
    setSortOrder(sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc');
  };
  
  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    return sortOrder === 'asc' 
      ? a[sortKey] > b[sortKey] ? 1 : -1
      : a[sortKey] < b[sortKey] ? 1 : -1;
  });
  
  return (
    <table>
      <caption>Employee Directory</caption>
      <thead>
        <tr>
          <th scope="col">
            <button 
              onClick={() => handleSort('name')}
              aria-label="Sort by name"
              aria-sort={sortKey === 'name' ? sortOrder + 'ending' : 'none'}
            >
              Name
            </button>
          </th>
          <th scope="col">Department</th>
          <th scope="col">Email</th>
        </tr>
      </thead>
      <tbody>
        {sortedData.map((employee) => (
          <tr key={employee.id}>
            <th scope="row">{employee.name}</th>
            <td>{employee.department}</td>
            <td>{employee.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <table>
    <caption>Monthly sales figures</caption>
    <thead>
      <tr>
        <th scope="col">Month</th>
        <th scope="col">Sales</th>
        <th scope="col">Target</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in data" :key="index">
        <th scope="row">{{ row.month }}</th>
        <td>{{ row.sales }}</td>
        <td>{{ row.target }}</td>
      </tr>
    </tbody>
  </table>
  
  <!-- Sortable table -->
  <table>
    <caption>Employee Directory</caption>
    <thead>
      <tr>
        <th scope="col">
          <button 
            @click="handleSort('name')"
            aria-label="Sort by name"
            :aria-sort="sortKey === 'name' ? sortOrder + 'ending' : 'none'"
          >
            Name
          </button>
        </th>
        <th scope="col">Department</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="employee in sortedData" :key="employee.id">
        <th scope="row">{{ employee.name }}</th>
        <td>{{ employee.department }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { ref, computed } from 'vue';

const data = ref([]);
const sortKey = ref(null);
const sortOrder = ref('asc');

const sortedData = computed(() => {
  if (!sortKey.value) return data.value;
  
  return [...data.value].sort((a, b) => {
    return sortOrder.value === 'asc'
      ? a[sortKey.value] > b[sortKey.value] ? 1 : -1
      : a[sortKey.value] < b[sortKey.value] ? 1 : -1;
  });
});

const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
};
</script>
```

### Angular
```typescript
// Component template
<table>
  <caption>Monthly sales figures</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Sales</th>
      <th scope="col">Target</th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let row of data">
      <th scope="row">{{ row.month }}</th>
      <td>{{ row.sales }}</td>
      <td>{{ row.target }}</td>
    </tr>
  </tbody>
</table>

<!-- Angular Material Table (accessible by default) -->
<table mat-table [dataSource]="dataSource">
  <caption>Employee Directory</caption>
  
  <ng-container matColumnDef="name">
    <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
    <td mat-cell *matCellDef="let element">{{ element.name }}</td>
  </ng-container>
  
  <ng-container matColumnDef="department">
    <th mat-header-cell *matHeaderCellDef>Department</th>
    <td mat-cell *matCellDef="let element">{{ element.department }}</td>
  </ng-container>
  
  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
</table>

// Component TypeScript
import { Component } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';

@Component({
  selector: 'app-sales-table',
  templateUrl: './sales-table.component.html'
})
export class SalesTableComponent {
  data = [
    { month: 'January', sales: 10000, target: 12000 },
    { month: 'February', sales: 12500, target: 12000 }
  ];
  
  dataSource = new MatTableDataSource(this.data);
  displayedColumns = ['name', 'department'];
}
```
