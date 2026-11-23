import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { SearchInput } from "./search-input";

const meta: Meta<typeof SearchInput> = {
  title: "UI/SearchInput",
  component: SearchInput
};

export default meta;

type IStory = StoryObj<typeof SearchInput>;

export const Default: IStory = {
  render: function Render() {
    const [value, setValue] = useState("design");

    return (
      <SearchInput
        wrapperClassName='max-w-md'
        value={value}
        placeholder='Search projects'
        aria-label='Search projects'
        clearLabel='Clear search'
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onClear={() => {
          setValue("");
        }}
      />
    );
  }
};
