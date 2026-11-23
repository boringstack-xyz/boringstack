import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./table";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table
};

export default meta;

type IStory = StoryObj<typeof Table>;

const ROWS = [
  ["Invoice 1042", "1,200.00", "Paid", "Mar 3"],
  ["Invoice 1043", "480.00", "Open", "Mar 9"],
  ["Invoice 1044", "95.50", "Overdue", "Mar 12"]
];

export const Default: IStory = {
  render: () => (
    <Table>
      <TableCaption>Recent invoices</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className='text-right'>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map(([invoice, amount, status, date]) => (
          <TableRow key={invoice}>
            <TableCell className='font-medium'>{invoice}</TableCell>
            <TableCell className='tabular-nums'>{amount}</TableCell>
            <TableCell>{status}</TableCell>
            <TableCell className='text-right'>{date}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
};
