import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "./command";

const meta: Meta<typeof Command> = {
  title: "UI/Command",
  component: Command,
  render: () => (
    <Command className='w-96 rounded-lg border shadow-md'>
      <CommandInput placeholder='Type a command or search…' />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading='Suggestions'>
          <CommandItem>Create a project</CommandItem>
          <CommandItem>Invite a teammate</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading='Account'>
          <CommandItem>Profile</CommandItem>
          <CommandItem>Settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
};

export default meta;

type IStory = StoryObj<typeof Command>;

export const Default: IStory = {};
