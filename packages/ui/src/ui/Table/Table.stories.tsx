import type { Meta, StoryObj } from '@storybook/react-vite'
import { Table, useTable } from './index'

type Product = { id: string; sku: string; name: string; available: number }

const rows: Product[] = [
  { id: '1', sku: 'BOLT-HEX-38', name: 'Galvanized hex bolt', available: 48 },
  { id: '2', sku: 'WASH-SS-10', name: 'Stainless washer pack', available: 120 },
  { id: '3', sku: 'NUT-NYL-06', name: 'Nylon lock nut', available: 0 },
]

function CatalogTable() {
  const table = useTable({
    data: rows,
    columns: [
      { id: 'sku', label: 'SKU', sort: 'sku', width: 140 },
      { id: 'name', label: 'Name', sort: 'name' },
      { id: 'available', label: 'Available', sort: 'available', width: 120, align: 'right' },
    ],
    getRowId: (row) => row.id,
    fillColumn: 'name',
    enableSorting: true,
    enableSelection: true,
    enablePagination: true,
    initialPageSize: 10,
  })

  return (
    <Table table={table} data-testid="story-table" emptyMessage="No products.">
      <Table.Header />
      <Table.Body />
      <Table.Empty />
      <Table.Pagination />
    </Table>
  )
}

const meta = {
  title: 'Design System/Table',
  tags: ['autodocs'],
  component: Table,
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

export const Products: Story = {
  render: () => (
    <div className="h-[420px]">
      <CatalogTable />
    </div>
  ),
}

export const Empty: Story = {
  render: function EmptyStory() {
    const table = useTable({
      data: [] as Product[],
      columns: [
        { id: 'sku', label: 'SKU', sort: 'sku', width: 140 },
        { id: 'name', label: 'Name', sort: 'name' },
      ],
      getRowId: (row) => row.id,
      fillColumn: 'name',
    })
    return (
      <Table table={table} data-testid="story-table-empty">
        <Table.Header />
        <Table.Body />
        <Table.Empty>No products match these filters.</Table.Empty>
      </Table>
    )
  },
}

export const Loading: Story = {
  render: function LoadingStory() {
    const table = useTable({
      data: [] as Product[],
      isPending: true,
      columns: [
        { id: 'sku', label: 'SKU', sort: 'sku', width: 140 },
        { id: 'name', label: 'Name', sort: 'name' },
      ],
      getRowId: (row) => row.id,
      fillColumn: 'name',
    })
    return (
      <Table table={table} data-testid="story-table-loading">
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>
    )
  },
}
