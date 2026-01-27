declare module '@react-native-picker/picker' {
  import * as React from 'react';
  import type { StyleProp, TextStyle, ViewProps, NativeSyntheticEvent, TargetedEvent, ColorValue } from 'react-native';

  export type ItemValue = number | string | object;

  export interface PickerItemProps<T = ItemValue> {
    label?: string;
    value?: T;
    color?: string;
    fontFamily?: string;
    testID?: string;
    style?: StyleProp<TextStyle>;
    enabled?: boolean;
  }

  export interface PickerProps<T = ItemValue> extends ViewProps {
    style?: StyleProp<TextStyle>;
    selectedValue?: T;
    onValueChange?: (itemValue: T, itemIndex: number) => void;
    enabled?: boolean;
    mode?: 'dialog' | 'dropdown';
    itemStyle?: StyleProp<TextStyle>;
    selectionColor?: ColorValue;
    prompt?: string;
    testID?: string;
    dropdownIconColor?: number | ColorValue;
    dropdownIconRippleColor?: number | ColorValue;
    numberOfLines?: number;
    accessibilityLabel?: string;
    placeholder?: string;
    onFocus?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
    onBlur?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
  }

  export class Picker<T = ItemValue> extends React.Component<PickerProps<T>, {}> {
    static readonly MODE_DIALOG: 'dialog';
    static readonly MODE_DROPDOWN: 'dropdown';
    static Item: React.ComponentType<PickerItemProps<ItemValue>>;
    focus: () => void;
    blur: () => void;
  }

  export interface PickerIOSProps extends PickerProps {
    itemStyle?: StyleProp<TextStyle>;
  }

  export class PickerIOS extends React.Component<PickerIOSProps, {}> {
    static Item: React.ComponentType<PickerItemProps<ItemValue>>;
  }
}
