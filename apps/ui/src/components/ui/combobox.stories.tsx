import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Combobox, type IComboboxOption } from "./combobox";
import { Label } from "./label";

const CURRENCIES: IComboboxOption[] = [
  { value: "eur", label: "Euro (EUR)" },
  { value: "usd", label: "US dollar (USD)" },
  { value: "gbp", label: "Pound sterling (GBP)" }
];

const REGIONS = ["Europe", "North America", "Asia Pacific"];
const COUNTRIES = [
  "Denmark",
  "Germany",
  "France",
  "Sweden",
  "Norway",
  "Spain",
  "Italy",
  "Poland",
  "Netherlands"
];

/* A longer list: countries under three regional headings, with a hint per row. */
const LOCATIONS: IComboboxOption[] = REGIONS.flatMap((region) =>
  COUNTRIES.map((country, index) => ({
    value: `${region}-${country}`.toLowerCase().replace(/\s/gu, "-"),
    label: `${country}, ${region}`,
    listLabel: country,
    group: region,
    hint: `+${String(index + 1)}`
  }))
);

function Controlled(props: {
  readonly label: string;
  readonly options: IComboboxOption[];
  readonly initial: string;
  readonly width?: string;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}) {
  const [value, setValue] = useState(props.initial);

  return (
    <div className={`grid gap-1.5 ${props.width ?? "max-w-sm"}`}>
      <Label htmlFor={props.label}>{props.label}</Label>
      <Combobox
        id={props.label}
        value={value}
        options={props.options}
        onValueChange={setValue}
        disabled={props.disabled}
        placeholder={props.placeholder}
        searchPlaceholder='Search countries'
        emptyText='No country matches.'
      />
    </div>
  );
}

const meta: Meta<typeof Combobox> = {
  title: "UI/Combobox",
  component: Combobox
};

export default meta;

type IStory = StoryObj<typeof Combobox>;

/** A long list: search, region headings that stay in view, a hint per row. */
export const Default: IStory = {
  render: () => <Controlled label='Country' options={LOCATIONS} initial='' />
};

/** A short list reads at a glance, so it has no search box. */
export const Short: IStory = {
  render: () => (
    <Controlled
      label='Currency'
      options={CURRENCIES}
      initial='usd'
      width='w-48'
    />
  )
};

export const Placeholder: IStory = {
  render: () => (
    <Controlled
      label='Role'
      options={[
        { value: "admin", label: "Admin" },
        { value: "member", label: "Member" },
        { value: "viewer", label: "Viewer" }
      ]}
      initial='none'
      placeholder='Choose a role'
    />
  )
};

export const Disabled: IStory = {
  render: () => (
    <Controlled
      label='Currency'
      options={CURRENCIES}
      initial='eur'
      width='w-48'
      disabled
    />
  )
};

/** Near the bottom of the screen the panel opens upwards instead. */
export const NearTheEdge: IStory = {
  render: () => (
    <div className='flex min-h-[80vh] items-end'>
      <Controlled label='Country' options={LOCATIONS} initial='' />
    </div>
  )
};
