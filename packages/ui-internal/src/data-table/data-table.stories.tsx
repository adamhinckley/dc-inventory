import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable } from "./data-table";
import type { ListQueryParams } from "./list-params";
import type { TableMeta } from "./table-meta";
import type { ListQueryHook } from "./use-data-table";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
  status: "active" | "inactive";
};

const rows: ProductRow[] = [
  {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    sku: "BOLT-HEX-38",
    name: "Galvanized hex bolt",
    onHand: 50,
    onOrder: 12,
    allocated: 2,
    available: 48,
    status: "active",
  },
  {
    id: "2f1a0b8c-3d4e-4f5a-8b6c-7d8e9f0a1b2c",
    sku: "WASH-SS-10",
    name: "Stainless washer pack",
    onHand: 120,
    onOrder: 0,
    allocated: 0,
    available: 120,
    status: "active",
  },
  {
    id: "0a1b2c3d-4e5f-4678-89ab-cdef01234567",
    sku: "NUT-NYL-06",
    name: "Nylon lock nut",
    onHand: 0,
    onOrder: 40,
    allocated: 0,
    available: 0,
    status: "inactive",
  },
];

const useMockProducts: ListQueryHook<ListQueryParams, ProductRow> = (params) => {
  const q = params?.q?.toLowerCase();
  const status = params?.status;
  const filtered = rows.filter((row) => {
    if (status && row.status !== status) {
      return false;
    }
    if (!q) {
      return true;
    }
    return row.sku.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
  });
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 25;
  const start = (page - 1) * pageSize;
  return {
    data: {
      data: {
        items: filtered.slice(start, start + pageSize),
        page,
        pageSize,
        total: filtered.length,
      },
      status: 200,
    },
    isPending: false,
    isError: false,
  };
};

const productsListTable = {
  rowId: "id",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "name", label: "Name" },
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "available", label: "Available" },
    { field: "status", label: "Status" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
  filters: [{ param: "status", control: "select" }],
} as const satisfies TableMeta;

const meta = {
  title: "ui-internal/DataTable",
  tags: ['autodocs'],
  component: DataTable.Root,
  render: (args) => (
    <DataTable.Root {...args}>
      <DataTable.Toolbar>
        <DataTable.Search />
        <DataTable.Filters />
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  ),
} satisfies Meta<typeof DataTable.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProductsList: Story = {
  args: {
    meta: productsListTable,
    queryHook: useMockProducts,
    filterOptions: {
      status: [
        { value: "active", label: "active" },
        { value: "inactive", label: "inactive" },
      ],
    },
  },
};

const inventoryRows = [
  {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    sku: "BOLT-HEX-38",
    name: "Galvanized hex bolt",
    onHand: 50,
    onOrder: 12,
    allocated: 2,
    committed: 8,
    available: 48,
    availableToSell: 54,
    sellState: "locked",
  },
  {
    id: "2f1a0b8c-3d4e-4f5a-8b6c-7d8e9f0a1b2c",
    sku: "WASH-SS-10",
    name: "Stainless washer pack",
    onHand: 0,
    onOrder: 0,
    allocated: 0,
    committed: 20,
    available: 0,
    availableToSell: null,
    sellState: "open",
  },
];

const inventoryListTable = {
  rowId: "id",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "name", label: "Name" },
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "committed", label: "Committed (pre-sold)" },
    { field: "available", label: "Available (warehouse)" },
    { field: "availableToSell", label: "Available to sell" },
    { field: "sellState", label: "Sell state" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
} as const satisfies TableMeta;

export const InventorySnapshot: Story = {
  args: {
    meta: inventoryListTable,
    queryHook: () => ({
      data: {
        data: {
          items: inventoryRows,
          page: 1,
          pageSize: 25,
          total: inventoryRows.length,
        },
        status: 200,
      },
      isPending: false,
      isError: false,
    }),
  },
};

export const Empty: Story = {
  args: {
    meta: productsListTable,
    queryHook: () => ({
      data: { data: { items: [], page: 1, pageSize: 25, total: 0 }, status: 200 },
      isPending: false,
      isError: false,
    }),
  },
};
