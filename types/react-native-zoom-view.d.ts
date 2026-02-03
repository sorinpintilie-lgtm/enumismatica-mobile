declare module 'react-native-zoom-view' {
  import { ComponentType } from 'react';
  import { ViewProps } from 'react-native';

  interface ZoomViewProps extends ViewProps {
    maxScale?: number;
    minScale?: number;
    zoomStep?: number;
    initialScale?: number;
    bindToBorders?: boolean;
  }

  const ZoomView: ComponentType<ZoomViewProps>;
  export default ZoomView;
}
