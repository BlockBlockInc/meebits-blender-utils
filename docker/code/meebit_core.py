"""
This contains the core functionalities for:
1. Reading .vox files 
2. Converting .vox files into blender objects

import_meebit_vox is the central method which parses the vox files and triggers generation of blender object via VoxelObject.generate
"""

# Developer debug tips. Shift+F4 for python console .  obj = bpy.data.objects['meebit_16734_t'] to get object and experiment on what's possible

import os

import bpy

import struct

# Represent a Voxel vector     
class Vec3:
    def __init__(self, X, Y, Z):
        self.x, self.y, self.z = X, Y, Z
    
    def _index(self):
        return self.x + self.y*256 + self.z*256*256

# Represent a Voxel model and is initiated by a set of voxels and a size
# generate method converts the model into a blender mesh
# New options are expected to be added to generate over time
class VoxelObject:
    def __init__(self, Voxels, Size):
        self.size = Size
        self.voxels = {}
        self.used_colors = []
        self.position = Vec3(0, 0, 0)
        self.rotation = Vec3(0, 0, 0)
        
        for vox in Voxels:
            #              x       y       z
            pos = Vec3(vox[0], vox[1], vox[2])
            self.voxels[pos._index()] = (pos, vox[3])
            
            if vox[3] not in self.used_colors:
                self.used_colors.append(vox[3])
            
    
    def getVox(self, pos):
        key = pos._index()
        if key in self.voxels:
            return self.voxels[key][1]
        
        return 0
    
    def compareVox(self, colA, b):
        colB = self.getVox(b)
        
        if colB == 0:
            return False
        return True
    
    # TODO: Refactor this central method
    def generate(self, file_name, vox_size, material_type, palette, materials, cleanup, collections,meebit_rig,scale_meebit_rig,shade_smooth_meebit):
        objects = []
        lights = []
        
        self.materials = materials  # For helper functions.
        
        mesh_col, light_col, volume_col = collections
        
        if len(self.used_colors) == 0: # Empty Object
            return
        
        for Col in self.used_colors: # Create an object for each color and then join them.
            
            mesh = bpy.data.meshes.new(file_name) # Create mesh
            obj = bpy.data.objects.new(file_name, mesh) # Create object
            
            # Create light data
            if light_col != None and materials[Col-1][3] > 0:
                light_data = bpy.data.lights.new(name=file_name+"_"+str(Col), type="POINT")
                light_data.color = palette[Col-1][:3]
                light_data.energy = materials[Col-1][3] * 500 * vox_size
                light_data.specular_factor = 0  # Don't want circular reflections.
                light_data.shadow_soft_size = vox_size/2
                light_data.shadow_buffer_clip_start = vox_size
            
            # Link Object to Scene
            if mesh_col == None:
                bpy.context.scene.collection.objects.link(obj)
            else:
                mesh_col.objects.link(obj)
            
            objects.append(obj) # Keeps track of created objects for joining.
            
            verts = []
            faces = []
            
            for key in self.voxels:
                pos, colID = self.voxels[key]
                x, y, z = pos.x, pos.y, pos.z
                
                if colID != Col:
                    continue
                
                # Lights
                if light_col != None and materials[Col-1][3] > 0:
                    light_obj = bpy.data.objects.new(name=file_name+"_"+str(Col), object_data=light_data)
                    light_obj.location = (x+0.5, y+0.5,z+0.5)  # Set location to center of voxel.
                    light_col.objects.link(light_obj)
                    lights.append(light_obj)
                
                            
                if not self.compareVox(colID, Vec3(x+1, y, z)):
                    verts.append( (x+1, y, z) )
                    verts.append( (x+1, y+1, z) )
                    verts.append( (x+1, y+1, z+1) )
                    verts.append( (x+1, y, z+1) )
                    
                    faces.append( [len(verts)-4,
                                    len(verts)-3,
                                    len(verts)-2,
                                    len(verts)-1] )
                
                if not self.compareVox(colID, Vec3(x, y+1, z)):
                    verts.append( (x+1, y+1, z) )
                    verts.append( (x+1, y+1, z+1) )
                    verts.append( (x, y+1, z+1) )
                    verts.append( (x, y+1, z) )
                    
                    faces.append( [len(verts)-4,
                                    len(verts)-3,
                                    len(verts)-2,
                                    len(verts)-1] )
                
                if not self.compareVox(colID, Vec3(x, y, z+1)):
                    verts.append( (x, y, z+1) )
                    verts.append( (x, y+1, z+1) )
                    verts.append( (x+1, y+1, z+1) )
                    verts.append( (x+1, y, z+1) )
                    
                    faces.append( [len(verts)-4,
                                    len(verts)-3,
                                    len(verts)-2,
                                    len(verts)-1] )
                
                if not self.compareVox(colID, Vec3(x-1, y, z)):
                    verts.append( (x, y, z) )
                    verts.append( (x, y+1, z) )
                    verts.append( (x, y+1, z+1) )
                    verts.append( (x, y, z+1) )
                    
                    faces.append( [len(verts)-4,
                                    len(verts)-3,
                                    len(verts)-2,
                                    len(verts)-1] )
                
                if not self.compareVox(colID, Vec3(x, y-1, z)):
                    verts.append( (x, y, z) )
                    verts.append( (x, y, z+1) )
                    verts.append( (x+1, y, z+1) )
                    verts.append( (x+1, y, z) )
                    
                    faces.append( [len(verts)-4,
                                    len(verts)-3,
                                    len(verts)-2,
                                    len(verts)-1] )
                
                if not self.compareVox(colID, Vec3(x, y, z-1)):
                    verts.append( (x, y, z) )
                    verts.append( (x+1, y, z) )
                    verts.append( (x+1, y+1, z) )
                    verts.append( (x, y+1, z) )
                    
                    faces.append( [len(verts)-4,
                                    len(verts)-3,
                                    len(verts)-2,
                                    len(verts)-1] )
                                        
            mesh.from_pydata(verts, [], faces)
            
            if material_type == 'SepMat':
                obj.data.materials.append(bpy.data.materials.get(file_name + " #" + str(Col)))
            
            elif material_type == 'VertCol':
                obj.data.materials.append(bpy.data.materials.get(file_name))
                
                # Create Vertex Colors
                bpy.context.view_layer.objects.active = obj
                bpy.ops.mesh.vertex_color_add() # Color
                bpy.ops.mesh.vertex_color_add() # Materials
                bpy.context.object.data.vertex_colors["Col.001"].name = "Mat"
                
                # Set Vertex Colors
                color_layer = mesh.vertex_colors["Col"]
                material_layer = mesh.vertex_colors["Mat"]
                
                i = 0
                for poly in mesh.polygons:
                    for idx in poly.loop_indices:
                        color_layer.data[i].color = palette[Col-1]
                        #                                                                                        Map emit value from [0,5] to [0,1]
                        material_layer.data[i].color = [materials[Col-1][0], materials[Col-1][1], materials[Col-1][2], materials[Col-1][3]/5]
                        i += 1
            
            elif material_type == 'Tex':
                obj.data.materials.append(bpy.data.materials.get(file_name))
                
                # Create UVs
                uv = obj.data.uv_layers.new(name="UVMap")
                for loop in obj.data.loops:
                    uv.data[loop.index].uv = [(Col-0.5)/256, 0.5]
                
        
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True) # Select all objects that were generated.
        
        obj = objects[0]
        bpy.context.view_layer.objects.active = obj # Make the first one active.
        bpy.ops.object.join() # Join selected objects.
        
        # Sets the origin of object to be the same as in MagicaVoxel so that its location can be set correctly.
        bpy.context.scene.cursor.location = [0, 0, 0]

        # Meebit - Set location
        obj.location = [-self.size.x/2.0, -self.size.y/2.0, -self.size.z/2.0]
        
        # Meebit - Set origin to prepare for rigging
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        # bpy.ops.object.origin_set(type='ORIGIN_CURSOR', center='MEDIAN')
        
        # Meebit - attempt to set location
        obj.location.z += vox_size*obj.dimensions.z/2.0

        for light in lights:
            light.parent = obj  # Parent Lights to Object
            x, y, z = light.location  # Fix Location
            light.location = [x+int(-self.size.x/2), y+int(-self.size.y/2), z+int(-self.size.z/2)]
        
        # Set scale and position.
        bpy.ops.transform.translate(value=(self.position.x*vox_size, self.position.y*vox_size, self.position.z*vox_size))
        bpy.ops.transform.resize(value=(vox_size, vox_size, vox_size))
        
        if shade_smooth_meebit:
            print("Applying shade smooth")
            # Each faces must be smooth shaded https://blender.stackexchange.com/a/91687
            mesh = obj.data
            obj.data.use_auto_smooth = 1
            for f in mesh.polygons:
                f.use_smooth = True

        # Cleanup Mesh
        if cleanup:
            bpy.ops.object.editmode_toggle()
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.remove_doubles()
            bpy.ops.mesh.normals_make_consistent(inside=False)
            bpy.ops.object.editmode_toggle()

        if meebit_rig:
            if bpy.data.objects.get("MeebitArmature") is not None:
                armature = bpy.data.objects['MeebitArmature'] 
                print("Found meebit armature 'MeebitArmature'") 
                
                # Need to do scaling first
                if scale_meebit_rig:
                    print("Scaling armature to fit meebit dimensions") 
                    # From https://blender.stackexchange.com/a/74496

                    # Convert to world coordinates if you want to use world Y
                    # We now use @ instead of * as per https://wiki.blender.org/wiki/Reference/Release_Notes/2.80/Python_API#Matrix_Multiplication
                    objBound = obj.matrix_world.to_quaternion() @ obj.dimensions
                    armBound = armature.matrix_world.to_quaternion() @ armature.dimensions

                    ratio = abs(objBound.z)/ abs(armBound.z) 
                    print("Scaling armature with ratio:", ratio)
                    armature.scale *= ratio
                
                # From https://blender.stackexchange.com/a/103004
                # https://docs.blender.org/api/current/bpy.ops.object.html#bpy.ops.object.parent_set
                bpy.ops.object.select_all(action='DESELECT') #deselect all objects
                obj.select_set(True)
                armature.select_set(True)
                bpy.context.view_layer.objects.active = armature    #the active object will be the parent of all selected object

                bpy.ops.object.parent_set(type='ARMATURE_AUTO', keep_transform=True)
                

            else:
                print("Found no meebit armature with name'MeebitArmature'") 


################################################################################################################################################
################################################################################################################################################

def read_chunk(buffer):
    *name, h_size, h_children = struct.unpack('<4cii', buffer.read(12))
    name = b"".join(name)
    content = bytearray(buffer.read(h_size))
    return name, content

def read_content(content, size):
    out = content[:size]
    del content[:size]
    
    return out

def read_dict(content):
    dict = {}
    
    dict_size, = struct.unpack('<i', read_content(content, 4))
    for _ in range(dict_size):
        key_bytes, = struct.unpack('<i', read_content(content, 4))
        key = struct.unpack('<'+str(key_bytes)+'c', read_content(content, key_bytes))
        key = b"".join(key)
        
        value_bytes, = struct.unpack('<i', read_content(content, 4))
        value = struct.unpack('<'+str(value_bytes)+'c', read_content(content, value_bytes))
        value = b"".join(value)
        
        dict[key] = value
    
    return dict

def import_meebit_vox(path, options):
    
    if options.optimize_import_for_type == 'Blender':
        options.material_type = 'SepMat'
    elif options.optimize_import_for_type == 'VRM':
        options.material_type = 'Tex'

    with open(path, 'rb') as file:
        file_name = os.path.basename(file.name).replace('.vox', '')
        file_size = os.path.getsize(path)
        
        palette = []
        materials = [[0.5, 0.0, 0.0, 0.0] for _ in range(255)] # [roughness, metallic, glass, emission] * 255
        
        # Makes sure it's supported vox file
        assert (struct.unpack('<4ci', file.read(8)) == (b'V', b'O', b'X', b' ', 150))
        
        # MAIN chunk
        assert (struct.unpack('<4c', file.read(4)) == (b'M', b'A', b'I', b'N'))
        N, M = struct.unpack('<ii', file.read(8))
        assert (N == 0)
        
        models = {}  # {model id : VoxelObject}
        mod_id = 0
        
        transforms = {}  # Transform Node {child id : [location, rotation]}
        groups = {}  # Group Node {id : [children ids]}
        shapes = {}  # Shape Node {id : [model ids]}
        
        ### Parse File ###
        while file.tell() < file_size:
            name, content = read_chunk(file)
            
            if name == b'SIZE': # Size of object.
                x, y, z = struct.unpack('<3i', read_content(content, 12))
                size = Vec3(x, y, z)
            
            elif name == b'XYZI': # Location and color id of voxel.
                voxels = []
                
                num_voxels, = struct.unpack('<i', read_content(content, 4))
                for voxel in range(num_voxels):
                    voxel_data = struct.unpack('<4B', read_content(content, 4))
                    voxels.append(voxel_data)
                
                model = VoxelObject(voxels, size)
                models[mod_id] = model
                mod_id += 1
            
            
            elif name == b'nTRN': # Position and rotation of object.
                id, = struct.unpack('<i', read_content(content, 4))
                
                # Don't need node attributes.
                _ = read_dict(content)
                
                child_id, _, _, _, = struct.unpack('<4i', read_content(content, 16))
                transforms[child_id] = [Vec3(0, 0, 0), Vec3(0, 0, 0)]
                
                frames = read_dict(content)
                for key in frames:
                    if key == b'_r':  # Rotation
                        pass # Can't figure out how to read rotation.
                    
                    elif key == b'_t':  # Translation
                        value = frames[key].decode('utf-8').split()
                        transforms[child_id][0] = Vec3(int(value[0]), int(value[1]), int(value[2]))
            
            elif name == b'nGRP':
                id, = struct.unpack('<i', read_content(content, 4))
                
                # Don't need node attributes.
                _ = read_dict(content)
                
                num_child, = struct.unpack('<i', read_content(content, 4))
                children = []
                
                for _ in range(num_child):
                    children.append(struct.unpack('<i', read_content(content, 4))[0])
                
                groups[id] = children
            
            elif name == b'nSHP':
                id, = struct.unpack('<i', read_content(content, 4))
                
                # Don't need node attributes.
                _ = read_dict(content)
                
                num_models, = struct.unpack('<i', read_content(content, 4))
                model_ids = []
                
                for _ in range(num_models):
                    model_ids.append(struct.unpack('<i', read_content(content, 4))[0])
                    _ = read_dict(content)  # Don't need model attributes.
                
                shapes[id] = model_ids
            
            elif name == b'RGBA':
                for _ in range(255):
                    rgba = struct.unpack('<4B', read_content(content, 4))
                    palette.append([float(col)/255 for col in rgba])
                del content[:4] # Contains a 256th color for some reason.
            
            elif name == b'MATL':
                id, = struct.unpack('<i', read_content(content, 4))
                if id > 255: continue # Why are there material values for id 256?
                
                mat_dict = read_dict(content)
                
                for key in mat_dict:
                    value = mat_dict[key]
                    
                    mat = materials[id-1]
                    
                    if key == b'_type':
                        type = value
                    
                    if key == b'_rough':
                        materials[id-1][0] = float(value) # Roughness
                    elif key == b'_metal' and type == b'_metal':
                        materials[id-1][1] = float(value) # Metalic
                    elif key == b'_alpha' and type == b'_glass':
                        materials[id-1][2] = float(value) # Glass
                    elif key == b'_emit' and type == b'_emit':
                        materials[id-1][3] = float(value) # Emission
                    elif key == b'_flux':
                        materials[id-1][3] *= float(value)+1 # Emission Power
                        
                        
    
    ### Import Options ###
    
    gamma_value = options.gamma_value
    if not options.gamma_correct:
        gamma_value = 1
    
    if options.material_type == 'SepMat': # Create material for every palette color.
        for id, col in enumerate(palette):
            
            col = (pow(col[0], gamma_value), pow(col[1], gamma_value), pow(col[2], gamma_value), col[3])
            
            name = file_name + " #" + str(id+1)
            
            if name in bpy.data.materials:
                if not options.override_materials: # Don't change materials.
                    continue
                # Delete material and recreate it.
                bpy.data.materials.remove(bpy.data.materials[name])
            
            mat = bpy.data.materials.new(name = name)
            mat.use_nodes = True
            mat.diffuse_color = col
            
            nodes = mat.node_tree.nodes
            
            bsdf = nodes["Principled BSDF"]
            bsdf.inputs["Base Color"].default_value = col
            
            bsdf.inputs["Roughness"].default_value = materials[id][0]
            bsdf.inputs["Metallic"].default_value = materials[id][1]
            bsdf.inputs["Transmission"].default_value = materials[id][2]
            bsdf.inputs["Emission Strength"].default_value = materials[id][3] * 20
            bsdf.inputs["Emission"].default_value = col
                
    elif options.material_type == 'VertCol': # Create one material that uses vertex colors.
        name = file_name
        create_mat = True
        
        if name in bpy.data.materials: # Material already exists.
            if options.override_materials:
                # Delete material and recreate it.
                bpy.data.materials.remove(bpy.data.materials[name])
            else:
                # Don't change materials.
                create_mat = False
        
        if create_mat: # Materials don't already exist or materials are being overriden.
            mat = bpy.data.materials.new(name = name)
            mat.use_nodes = True
            
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            
            bsdf = nodes["Principled BSDF"]
            
            vc_color = nodes.new("ShaderNodeVertexColor")
            vc_color.layer_name = "Col"
            vc_mat = nodes.new("ShaderNodeVertexColor")
            vc_mat.layer_name = "Mat"

            sepRGB = nodes.new("ShaderNodeSeparateRGB")
            multiply = nodes.new("ShaderNodeMath")
            multiply.operation = "MULTIPLY"
            multiply.inputs[1].default_value = 100

            links.new(vc_color.outputs["Color"], bsdf.inputs["Base Color"])
            links.new(vc_mat.outputs["Color"], sepRGB.inputs["Image"])
            links.new(sepRGB.outputs["R"], bsdf.inputs["Roughness"])
            links.new(sepRGB.outputs["G"], bsdf.inputs["Metallic"])
            links.new(sepRGB.outputs["B"], bsdf.inputs["Transmission"])
            links.new(vc_color.outputs["Color"], bsdf.inputs["Emission"])
            links.new(vc_mat.outputs["Alpha"], multiply.inputs[0])
            links.new(multiply.outputs[0], bsdf.inputs["Emission Strength"])
    
    elif options.material_type == 'Tex':  # Generates textures to store color and material data.
        name = file_name
        create_mat = True
        
        if name in bpy.data.materials: # Material already exists.
            if options.override_materials:
                # Delete material + texture and recreate it.
                bpy.data.materials.remove(bpy.data.materials[name])
                bpy.data.images.remove(bpy.data.images[name + '_col'])
                bpy.data.images.remove(bpy.data.images[name + '_mat'])
            else:
                # Don't change materials.
                create_mat = False
        
        if create_mat:
            ## Generate Texture
            
            col_img = bpy.data.images.new(name + '_col', width = 256, height = 1)
            mat_img = bpy.data.images.new(name + '_mat', width = 256, height = 1)
            mat_img.colorspace_settings.name = 'Non-Color'
            col_pixels = []
            mat_pixels = []
            
            for i in range(255):
                col = palette[i]
                mat = materials[i]
                
                col_pixels += col
                #                                  Map emit value from [0,5] to [0,1]
                mat_pixels += [mat[0], mat[1], mat[2], mat[3]/5]
            
            col_pixels += [0,0,0,0]
            mat_pixels += [0,0,0,0]
            
            col_img.pixels = col_pixels
            mat_img.pixels = mat_pixels
            
            
            ## Create Material
            
            mat = bpy.data.materials.new(name = name)
            mat.use_nodes = True
            
            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            
            bsdf = nodes["Principled BSDF"]
            
            col_tex = nodes.new("ShaderNodeTexImage")
            col_tex.image = col_img
            mat_tex = nodes.new("ShaderNodeTexImage")
            mat_tex.image = mat_img
            
            sepRGB = nodes.new("ShaderNodeSeparateRGB")
            multiply = nodes.new("ShaderNodeMath")
            multiply.operation = "MULTIPLY"
            multiply.inputs[1].default_value = 100
            
            links.new(col_tex.outputs["Color"], bsdf.inputs["Base Color"])
            links.new(mat_tex.outputs["Color"], sepRGB.inputs["Image"])
            links.new(sepRGB.outputs["R"], bsdf.inputs["Roughness"])
            links.new(sepRGB.outputs["G"], bsdf.inputs["Metallic"])
            links.new(sepRGB.outputs["B"], bsdf.inputs["Transmission"])
            links.new(col_tex.outputs["Color"], bsdf.inputs["Emission"])
            links.new(mat_tex.outputs["Alpha"], multiply.inputs[0])
            links.new(multiply.outputs[0], bsdf.inputs["Emission Strength"])

            # Meebit - Pack these images so that they're part of the blender scene and not lost on reopen
            # https://github.com/elsewhat/meebits-blender-utils/issues/10
            # https://blender.stackexchange.com/questions/142888/how-to-pack-data-into-blend-with-bpy-data-libraries-write
            print("Packing image " + name + '_col' + " into blender file")
            bpy.data.images[name + '_col'].pack()
            print("Packing image " + name + '_mat' + " into blender file")
            # This does not have the effect we want as it loose data on persistence 
            bpy.data.images[name + '_mat'].pack()

        # Ref https://github.com/elsewhat/meebits-blender-utils/issues/12
        # Might have done this whilst creating the material as well. But now if this fails, the default material should be ok
        if options.mtoon_shader:
            print("Applying MToon_unversioned shader to meebit material")

            shader_node_group_name = "MToon_unversioned"
            # mat = bpy.data.materials['meebit_16734_t']
            # Possibly init the material
            #for node in mat.node_tree.nodes:
            #    if node.type != "OUTPUT_MATERIAL":
            #        mat.node_tree.nodes.remove(node)

            # Change shader type
            mat = bpy.data.materials[name]
            mat.use_nodes = True
            node_group = mat.node_tree.nodes.new("ShaderNodeGroup")
            try:
                # Will throw exception if VRM add-on is not installed
                node_group.node_tree = bpy.data.node_groups[shader_node_group_name]

                mat.node_tree.links.new(
                    mat.node_tree.nodes["Material Output"].inputs["Surface"],
                    node_group.outputs["Emission"],
                )

                # Link Texture image 
                #node_texture = mat.node_tree.nodes.new(type='ShaderNodeTexImage')
                #node_texture.image =bpy.data.images["meebit_16734_t_col"]

                mat.node_tree.links.new(
                    col_tex.outputs["Color"],
                    mat.node_tree.nodes["Group"].inputs["MainTexture"],
                ) 
                
                # Correct ShadeColor
                mat.node_tree.nodes["Group"].inputs["ShadeColor"].default_value=[0.1,0.1,0.1,1]   
            except (RuntimeError, KeyError) as ex:
                error_report = "\n".join(ex.args)
                print(error_report)
                print("MToon_unversioned shader missing. Install VRM add-on from https://github.com/saturday06/VRM_Addon_for_Blender and restart")
                options.report({"WARNING"}, "MToon_unversioned shader missing. Install VRM add-on from https://github.com/saturday06/VRM_Addon_for_Blender")
                return {"CANCELLED"}
            pass
        
    
    
    ### Apply Transforms ##
    for trans_child in transforms:
        trans = transforms[trans_child]
        
        if trans_child in groups:
            group_children = groups[trans_child]
            # In my testing, group nodes never have valid
            # children ids. Is the documentation correct?
        
        if trans_child in shapes:
            shape_children = shapes[trans_child]
            
            for model_id in shape_children:
                models[model_id].position = trans[0]
    
    ## Create Collections ##
    collections = (None, None, None)
    if options.organize:
        main = bpy.data.collections.new(file_name)
        bpy.context.scene.collection.children.link(main)
        
        mesh_col = bpy.data.collections.new("Meshes")
        main.children.link(mesh_col)
        
        if options.create_lights:
            light_col = bpy.data.collections.new("Lights")
            main.children.link(light_col)
        else:
            light_col = None
        
        if options.create_volume:
            volume_col = bpy.data.collections.new("Volumes")
            main.children.link(volume_col)
        else:
            volume_col = None
        
        collections = (mesh_col, light_col, volume_col)
    
    ### Generate Objects ###
    for model in models.values():
        model.generate(file_name, options.voxel_size, options.material_type, palette, materials, options.cleanup_mesh, collections, options.join_meebit_armature,options.scale_meebit_armature,options.shade_smooth_meebit)
