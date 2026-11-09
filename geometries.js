
engine.geometries = (function () {
	const geometries = {};
	// the shapes the engine's users ask of the wasm (geometry.cpp): each returns the geometry object
	geometries.plane = function (width, height, divsX, divsY, plane) {
		return engine._geometries.get(wa.geometry_plane(width, height, divsX, divsY, plane));
	};

	geometries.cube = function (width, height, depth, divs) {
		return engine._geometries.get(wa.geometry_cube(width, height, depth, divs));
	};
	geometries.cube_offset = function (width, height, depth, divs, offset_x, offset_y, offset_z) {
		return engine._geometries.get(wa.geometry_cube_offset(width, height, depth, divs, offset_x, offset_y, offset_z));
	};

	geometries.sphere = function (rad, divsX, divsY) {
		return engine._geometries.get(wa.geometry_sphere(rad, divsX, divsY));
	};

	geometries.capsule = function (radius, height, radialSegs, heightSegs) {
		return engine._geometries.get(wa.geometry_capsule(radius, height, radialSegs, heightSegs));
	};

	// the chunk plane of the terrain's quadtree (unindexed, geometry.cpp)
	geometries.plane_skirt_unindexed_xz = function (width, height, divsX, divsY) {
		return engine._geometries.get(wa.geometry_plane_skirt_unindexed_xz(width, height, divsX, divsY));
	};


	const amap = {
		"POSITION": "a_position",
		"NORMAL": "a_normal",
		"JOINTS_0": "a_bone_indices",
		"WEIGHTS_0": "a_bone_weights",
		"JOINTS_1": "a_bone_indices2",
		"WEIGHTS_1": "a_bone_weights2",
		"TANGENT": "a_tangent",
		"TEXCOORD_0": "a_uv",
		"TEXCOORD_1": "a_uv2",
		"TEXCOORD_2": "a_uv3",
		"TEXCOORD_3": "a_uv4",
		"_UV0": "a_uv",
		"_UV1": "a_uv2",
		"_UV2": "a_uv3",
		"_UV3": "a_uv4",
		"_UV4": "a_uv5",
		"_UV5": "a_uv6",
		"_UV6": "a_uv7",
		"_UV7": "a_uv8",
		"_UV8": "a_uv9",

		"COLOR": "a_color",
		"Vertex": "a_position",
		"Normal": "a_normal",
		"Bones": "a_bone_indices",
		"Weights": "a_bone_weights",
		"Tangent": "a_tangent",
		"TexCoord0": "a_uv",
		"TexCoord1": "a_uv",
		"TexCoord2": "a_uv",
		"TexCoord3": "a_uv",
		"TexCoord4": "a_uv",
		"TexCoord5": "a_uv",
		"TexCoord6": "a_uv",
		"TexCoord7": "a_uv",
		"TexCoord8": "a_uv",
		"color": "a_color",
		"Color": "a_color",
	};


	geometries.create = function (geo) {

		let attr = geo.attr || geo.attributes;
		if (Array.isArray(attr)) {
			attr = attr.reduce(function (col, a) {
				col[a.name] = a;
				return col;
			}, {});
		}
		const g = { attr: {} };
		let att;

		for (let k in attr) {
			att = attr[k];
			att.name = amap[att.name] ? amap[att.name] : (att.name || k);
			g.attr[att.name] = engine.geometry_set_attr(att, att.data).uuid;


		}
		g.uuid = engine.guid();

		if (geo.indices) {
			g.indices = engine.geometry_set_indices({}, geo.indices);
			g.draw_count = g.indices.data_length;
		}
		else {
			if (g.attr.a_position) {
				att = engine._attributes.get(g.attr.a_position);
				if (att && att.data_length) {
					g.draw_count = att.data_length / att.item_size;

				}
			}
		}

		engine._geometries.set(g.uuid, g);
		return g;

	}


	engine.geometry_set_attr = function (att, data, data_length) {
		const gl = engine.webgl.gl;
		if (att.uuid == undefined) {
			att.uuid = engine.guid();
			engine._attributes.set(att.uuid, att);
			att.buffer = null;
			att.divisor = att.divisor || 0;
			att.item_size = att.item_size || 3;
			att.buffer_type = att.buffer_type || GL_STATIC_DRAW;
			att.data_type = att.data_type || GL_FLOAT;
			att.stride = att.stride || 0;
			att.offset = att.offset || 0;

		}


		if (data) {
			if (att.buffer == null) {
				att.buffer = gl.createBuffer();
			}

			gl.bindBuffer(GL_ARRAY_BUFFER, att.buffer);
			att.data_length = data_length || data.length;
			//att.data = data;
			gl.bufferData(GL_ARRAY_BUFFER, data, att.buffer_type, 0, att.data_length);

		}
		return att;
	}

	engine.geometry_set_indices = function (indices, data, data_length) {
		const gl = engine.webgl.gl;
		indices = indices || {};

		if (data) {
			indices.buffer_type = indices.buffer_type || GL_DYNAMIC_DRAW;
			if (indices.buffer == null) {
				indices.buffer = gl.createBuffer();
			}
			data_length = data_length || data.length;

			gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, indices.buffer);
			gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, data, indices.buffer_type);
			indices.wireframe = indices.wireframe || { buffer: gl.createBuffer(), buffer_type: GL_DYNAMIC_DRAW };

			gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, indices.wireframe.buffer);
			const wire_indices = engine.wa.u32_array_scratch(data_length * 2);
			let ii = 0;
			let a, b, c;
			for (let i = 0; i < data_length; i += 3) {
				a = data[i];
				b = data[i + 1];
				c = data[i + 2];
				wire_indices[ii] = a;
				wire_indices[ii + 1] = b;
				wire_indices[ii + 2] = b;
				wire_indices[ii + 3] = c;
				wire_indices[ii + 4] = c;
				wire_indices[ii + 5] = a;
				ii += 6;
			}

			gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, wire_indices, indices.wireframe.buffer_type);
			indices.data_length = data_length;

		}

		return indices;
	};

	engine.create_geometry = function (geo) {
		geo = geo || {};
		geo.uuid = geo.uuid || engine.guid();
		geo.attr = geo.attr || {};
		engine._geometries.set(geo.uuid, geo);
		return geo;
	};
	engine.upload_geometry = env.upload_geometry = function (uuid, v_count, i_count, vertices, normals, uvs, indices, wire_indices) {




		//console.log([uuid, v_count, i_count, vertices, normals, uvs, indices]);
		const gl = engine.webgl.gl;
		const geo = engine.geometries[uuid] || {
			attr: {}
		};
		geo.uuid = uuid;
		engine._geometries.set(uuid, geo);


		geo.attr["a_position"] = engine.geometry_set_attr({}, engine.wa.fp32_array(v_count * 3, vertices)).uuid;
		geo.attr["a_normal"] = engine.geometry_set_attr({}, engine.wa.fp32_array(v_count * 3, normals)).uuid;
		geo.attr["a_uv"] = engine.geometry_set_attr({ item_size: 2 }, engine.wa.fp32_array(v_count * 2, uvs)).uuid;


		geo.draw_count = v_count;
		if (indices > 0) {
			geo.indices = geo.indices || { buffer: gl.createBuffer(), buffer_type: GL_DYNAMIC_DRAW };

			gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, geo.indices.buffer);
			gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, engine.wa.u32_array(i_count, indices), geo.indices.buffer_type);

			geo.indices.wireframe = geo.indices.wireframe || { buffer: gl.createBuffer(), buffer_type: GL_DYNAMIC_DRAW };
			geo.indices.data_length = i_count / 3;

			gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, geo.indices.wireframe.buffer);
			gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, engine.wa.u32_array(i_count * 2, wire_indices), geo.indices.wireframe.buffer_type);
			geo.draw_count = i_count;
		}




	}





	return geometries;

})();