import type { Meta, StoryObj } from "@storybook/react-vite";
import { productsListTable } from "../fixtures/products-list-table";
import { DataTable } from "./data-table";
import type { ListQueryParams } from "./list-params";
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

function compareProductField(
  left: ProductRow,
  right: ProductRow,
  field: string,
): number {
  const a = left[field as keyof ProductRow];
  const b = right[field as keyof ProductRow];
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
  });
}

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
  const sortBy = params?.sortBy ?? "sku";
  const direction = params?.sortOrder === "desc" ? -1 : 1;
  const sorted = [...filtered].sort(
    (left, right) => compareProductField(left, right, sortBy) * direction,
  );
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 25;
  const start = (page - 1) * pageSize;
  return {
    data: {
      data: {
        items: sorted.slice(start, start + pageSize),
        page,
        pageSize,
        total: sorted.length,
      },
      status: 200,
    },
    isPending: false,
    isError: false,
  };
};

const meta = {
  title: "ui-internal/DataTable",
  component: DataTable.Root,
  render: (args) => (
    <DataTable.Root {...args}>
      <DataTable.Search />
      <DataTable.Filters />
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
