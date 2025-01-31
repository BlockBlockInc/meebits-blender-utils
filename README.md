# Meebits blender utils
Blender import add-on for Meebits based on [MagicaVoxel `.vox` format](https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt).

In addition, the project provides conversion from of Meebits MagicaVoxel `.vox` format to:
- [VRM format for 3D avatars](https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm-1.0_draft)
- GLB
- OBJ
- FBX
 
The conversion is provided both as command-line option (requiring local installation of blender) and as a docker image.

![image](https://user-images.githubusercontent.com/1133607/118240998-ea5fa780-b49b-11eb-8090-6e48640d2211.png)

## Getting Started

### Installation

This add-on needs to be installed into Blender in order to be used.
The add-on to be installed is in the [`meebit-blender-add-on.zip`](meebit-blender-add-on.zip) file.
Directions for this process can be found [here](https://docs.blender.org/manual/en/latest/editors/preferences/addons.html#rd-party-add-ons) directly from the Blender Documentation.

**Note:** in order to enable the add-on, you will need to have `Testing` add-ons visible within the Blender Preferences menu.
![Enabling Add-on in Prefernces](https://user-images.githubusercontent.com/1133607/118412639-6411b400-b69b-11eb-9e1a-042ba46d388c.png)

### Usage
With the add-on installed and enabled, the importer can be accessed from `File > Import > Meebit (.vox)`
To automatically add rigging, open the supplied Blender scene MeebitRig.blend as your first step.

### Import options
This add-on offers several import options, seen on the file select menu of the import.


![image](https://user-images.githubusercontent.com/1133607/119262939-4aadc200-bbdd-11eb-8ad7-f684d8dda422.png)

The following settings are available:
*Optimize scene import for*
- *Blender scene rendering* - The imported model will have separate materials for each colored voxel. This allows blender users to easily change each materials properties, for example to make sunshades reflective
- *VRM Export (beta)* - The imported model will be optimized for usage as 3D avatar in the metaverse and the VRM file format. Model will have a single texture.

*Advanced options* 
- *Rig with Meebit armature*: If current scene has an armature with name MeebitArmature, it automatically joins them with automatic weights
- *Scale Meebit armature to fit*: Will scale the armature dimension to be the same as the meebits dimensions
- *Shade smooth*: Improve shading of model
- *Override materials if they exist*: The VRM Export creates a couple of materials which are named based on the original file name of the import. This option overrides the materials if they already exist in the blender scene.

## Questions and Concerns
Report issues in Github or raise them in the MeebitsDAO discord.

## Changelog and Versioning
v0.9.6 - Conversion to FBX, OBJ and GLB formats
v0.9.2 - Batch conversion to VRM through docker including VRM metadata.
v0.9.0 - Improved import dialog

## License
This project would not be possible without [saturday06/VRM_Addon_for_Blender](https://github.com/saturday06/VRM_Addon_for_Blender/).
This project is licensed under the GPL v3.0 License - see the [LICENSE](LICENSE) file for details
