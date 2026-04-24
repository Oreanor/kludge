export interface UILibrary {
  id: string
  name: string
  components: string[]
}

export const UI_LIBRARIES: UILibrary[] = [
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    components: [
      'Accordion', 'Alert', 'AlertDialog', 'AspectRatio', 'Avatar',
      'Badge', 'Breadcrumb', 'Button',
      'Calendar', 'Card', 'Carousel', 'Chart', 'Checkbox', 'Collapsible', 'Command',
      'ContextMenu',
      'DataTable', 'DatePicker', 'Dialog', 'Drawer', 'DropdownMenu',
      'Form',
      'HoverCard',
      'Input', 'InputOTP',
      'Label',
      'Menubar',
      'NavigationMenu',
      'Pagination', 'Popover', 'Progress',
      'RadioGroup', 'ResizablePanels',
      'ScrollArea', 'Select', 'Separator', 'Sheet', 'Sidebar', 'Skeleton', 'Slider',
      'Sonner', 'Switch',
      'Table', 'Tabs', 'Textarea', 'Toast', 'Toggle', 'ToggleGroup', 'Tooltip',
    ],
  },
  {
    id: 'radix',
    name: 'Radix UI',
    components: [
      'Accordion', 'AlertDialog', 'AspectRatio', 'Avatar',
      'Checkbox', 'Collapsible', 'ContextMenu',
      'Dialog', 'DropdownMenu',
      'Form',
      'HoverCard',
      'Label',
      'Menubar',
      'NavigationMenu',
      'Popover', 'Progress',
      'RadioGroup',
      'ScrollArea', 'Select', 'Separator', 'Slider', 'Switch',
      'Tabs', 'Toast', 'Toggle', 'ToggleGroup', 'Toolbar', 'Tooltip',
    ],
  },
  {
    id: 'mui',
    name: 'Material UI',
    components: [
      // inputs
      'Autocomplete', 'Button', 'ButtonGroup', 'Checkbox', 'ColorPicker',
      'DatePicker', 'DateTimePicker', 'FilledInput', 'FloatingActionButton',
      'IconButton', 'Input', 'LoadingButton', 'Radio', 'RadioGroup', 'Rating',
      'Select', 'Slider', 'Switch', 'TextField', 'TimePicker', 'ToggleButton', 'ToggleButtonGroup',
      // data display
      'Avatar', 'Badge', 'Chip', 'DataGrid', 'Divider', 'Icon', 'List',
      'Table', 'Tooltip', 'Typography',
      // feedback
      'Alert', 'Backdrop', 'CircularProgress', 'Dialog', 'LinearProgress',
      'Skeleton', 'Snackbar',
      // surfaces
      'Accordion', 'AppBar', 'Card', 'Paper',
      // navigation
      'BottomNavigation', 'Breadcrumbs', 'Drawer', 'Link', 'Menu',
      'Pagination', 'SpeedDial', 'Stepper', 'Tabs',
      // layout
      'Box', 'Container', 'Grid', 'ImageList', 'Stack',
    ],
  },
  {
    id: 'antd',
    name: 'Ant Design',
    components: [
      // inputs
      'AutoComplete', 'Cascader', 'Checkbox', 'ColorPicker', 'DatePicker',
      'Form', 'Input', 'InputNumber', 'Mentions', 'Radio', 'Rate',
      'Select', 'Slider', 'Switch', 'TimePicker', 'Transfer', 'TreeSelect', 'Upload',
      // data display
      'Avatar', 'Badge', 'Calendar', 'Card', 'Carousel', 'Collapse',
      'Descriptions', 'Empty', 'Image', 'List', 'Popover', 'QRCode',
      'Statistic', 'Table', 'Tabs', 'Tag', 'Timeline', 'Tooltip', 'Tree', 'Typography',
      // feedback
      'Alert', 'Drawer', 'Message', 'Modal', 'Notification',
      'Popconfirm', 'Progress', 'Result', 'Skeleton', 'Spin', 'Watermark',
      // navigation
      'Breadcrumb', 'Dropdown', 'Menu', 'Pagination', 'Steps',
      // layout
      'Divider', 'Flex', 'Grid', 'Layout', 'Space',
    ],
  },
  {
    id: 'chakra',
    name: 'Chakra UI',
    components: [
      // layout
      'AspectRatio', 'Box', 'Center', 'Container', 'Divider',
      'Flex', 'Grid', 'HStack', 'SimpleGrid', 'Spacer', 'Stack', 'VStack', 'Wrap',
      // forms
      'Button', 'Checkbox', 'Editable', 'FormControl', 'IconButton',
      'Input', 'NumberInput', 'PinInput', 'Radio', 'RangeSlider',
      'Select', 'Slider', 'Switch', 'Textarea',
      // data display
      'Avatar', 'Badge', 'Code', 'Kbd', 'List', 'Stat', 'Table', 'Tag', 'Tooltip',
      // feedback
      'Alert', 'CircularProgress', 'Progress', 'Skeleton', 'Spinner', 'Toast',
      // overlay
      'AlertDialog', 'Drawer', 'Menu', 'Modal', 'Popover',
      // navigation
      'Breadcrumb', 'Link', 'Tabs',
      // disclosure
      'Accordion',
    ],
  },
  {
    id: 'mantine',
    name: 'Mantine',
    components: [
      // buttons & actions
      'ActionIcon', 'Button', 'CloseButton', 'CopyButton', 'FileButton', 'UnstyledButton',
      // inputs
      'Autocomplete', 'Checkbox', 'Chip', 'ColorInput', 'ColorPicker',
      'Combobox', 'DatePicker', 'DatePickerInput', 'FileInput', 'JsonInput',
      'MultiSelect', 'NativeSelect', 'NumberInput', 'PasswordInput', 'PinInput',
      'Radio', 'Rating', 'RangeSlider', 'SegmentedControl', 'Select',
      'Slider', 'Switch', 'TagsInput', 'Textarea', 'TextInput', 'TimeInput', 'YearPicker',
      // layout
      'AppShell', 'Center', 'Container', 'Flex', 'Grid', 'Group',
      'SimpleGrid', 'Space', 'Stack',
      // data display
      'Accordion', 'Avatar', 'Badge', 'Card', 'Carousel', 'Code',
      'ColorSwatch', 'Highlight', 'Indicator', 'Kbd', 'List', 'Mark',
      'Paper', 'RingProgress', 'Spoiler', 'Table', 'Text', 'ThemeIcon', 'Timeline', 'Title',
      // feedback
      'Alert', 'Loader', 'Notification', 'Overlay', 'Progress', 'Skeleton',
      // overlay
      'Drawer', 'HoverCard', 'Menu', 'Modal', 'Popover', 'Tooltip',
      // navigation
      'Breadcrumbs', 'NavLink', 'Pagination', 'Stepper', 'Tabs',
    ],
  },
]
