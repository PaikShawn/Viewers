import AIPanel from './panels/AIPanel';
import LesionOverlay from './viewport/LesionOverlay';

const ohifExtensionAi = {
  id: 'ohif-extension-ai',
  meta: {
    name: 'OHIF AI Analysis',
    version: '1.0.0',
    description: 'AI-powered lesion detection and RECIST analysis',
  },
  getPanelModule({ servicesManager }) {
    return [
      {
        name: 'AIPanel',
        iconName: 'tab-patient-info',
        iconLabel: 'AI',
        label: 'AI Analysis',
        component: AIPanel,
      },
    ];
  },
  getViewportOverlayModule({ servicesManager }) {
    return [
      {
        name: 'lesionOverlay',
        component: LesionOverlay,
      },
    ];
  },
};

export default ohifExtensionAi;
