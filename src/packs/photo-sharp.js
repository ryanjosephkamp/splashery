// Lane Photo sharp view (prefix psv): the hook for the "Sharp" view of Photo to 3D and Moving photo
// to 3D (the picture at its full resolution on a 3D relief, a choice beside the splats). Each toy
// calls sharpEntry(id) in its input panel's live list, sharpPhoto(...) or sharpClip(...) at the end
// of its build and sharpDrive(out) at the end of its drive. Until the lane's PR brings the view
// itself, they do nothing, and the toys behave exactly as before.

export const sharpEntry = () => ({ render: () => document.createElement("span") });
export function sharpPhoto() {}
export function sharpClip() {}
export function sharpDrive() {}
