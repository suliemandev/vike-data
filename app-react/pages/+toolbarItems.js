// The app's contribution to vike-toolbar's cumulative `toolbarItems` point. Like
// +adminResources.js, it lives in its own +<configName>.js file because the entry
// carries a COMPONENT (the control) which Vike can't serialize into the page config; a
// dedicated file is pointer-imported instead, so the component reference survives to the
// client. Same cumulative seam as `nav` / `themes` — install an extension and its
// settings compose into the one popover, with zero toolbar-specific wiring.
import AppearanceSetting from '../components/AppearanceSetting.jsx'

export default [{ id: 'appearance', label: 'Appearance', order: 10, Control: AppearanceSetting }]
