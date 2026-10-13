import { createContext, useContext } from 'react';

/** Which section the user is hovering in the course list, for the calendar's ghost preview. */
export const PreviewContext = createContext({ previewCrn: null, setPreviewCrn: () => {} });
export const usePreview = () => useContext(PreviewContext);
