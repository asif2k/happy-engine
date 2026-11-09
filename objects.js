engine.shaders = (function () {



	const shaders = {
		inherritables: ['vertex', 'fragment', 'start_main', 'end_main'], hashes: {}
	};



	const shader_inheritance = {
		extract_function: function (code, funcName) {
			// We assume 'code' is already stripped of comments!
			//const sigRegex = new RegExp(("(?:\\w+\\s+)+" + (funcName) + "\\s*\\([^{]*\\)\\s*\\{" + ""));
			const sigRegex = new RegExp(
				"(?:\\w+\\s+)+" + funcName +
				"\\s*\\([^)]*\\)" +
				"\\s*(?!;)\\s*\\{",
				""
			);
			const match = sigRegex.exec(code);
			if (!match) return null;

			const startIndex = match.index;
			const openBraceIndex = startIndex + match[0].length - 1;
			let depth = 0;
			let endIndex = -1;

			for (let i = openBraceIndex; i < code.length; i++) {
				if (code[i] === '{') depth++;
				if (code[i] === '}') depth--;
				if (depth === 0) {
					endIndex = i;
					break;
				}
			}

			if (endIndex === -1) {
				console.error(("Shader parsing error: Unmatched brackets in function " + (funcName) + "" + ""));
				return null;
			}

			return {
				fullString: code.substring(startIndex, endIndex + 1),
				signature: code.substring(startIndex, openBraceIndex).trim(),
				body: code.substring(openBraceIndex + 1, endIndex),
				startIndex: startIndex,
				endIndex: endIndex,
				match: match
			};
		},

		extend: function (parentCode, childCode, depthLevel = 0) {
			if (!parentCode) return childCode;
			if (!childCode) return parentCode;

			const hooks = engine.shaders.inherritables;
			let finalParentCode = parentCode;
			let finalChildCode = childCode;
			const self = this;
			hooks.forEach(function (funcName) {
				const parentFunc = self.extract_function(finalParentCode, funcName);
				const childFunc = self.extract_function(finalChildCode, funcName);

				if (parentFunc && childFunc) {

					const superName = ("super_" + (funcName) + "_" + (depthLevel) + "" + "");
					const renamedParentSig = parentFunc.signature.replace(funcName, superName);
					const renamedParentFunc = ("" + (renamedParentSig) + " { " + (parentFunc.body) + " }" + "");


					finalParentCode = finalParentCode.substring(0, parentFunc.startIndex) +
						renamedParentFunc +
						finalParentCode.substring(parentFunc.endIndex + 1);




					const superCallRegex = new RegExp(("super_" + (funcName) + "\\s*\\(" + ""), 'g');

					//console.log("hook", [funcName, superName,  superCallRegex, parentFunc, childFunc]);

					//finalParentCode = finalParentCode.replace(baseCallRegex, ("" + (superName) + "(" + ""));


					finalChildCode = finalChildCode.replace(superCallRegex, ("" + (superName) + "(" + ""));



				}
			});
			let source = ("" + (finalParentCode) + "\n\n// --- INHERITANCE DEPTH " + (depthLevel + 1) + " ---\n\n" + (finalChildCode) + "" + "");
			
			return source;
		}
	};
	function sort_defs(source, defs) {

		
		// Temporarily protect WebGL2 keywords
		source = source.replace(/varying out/g, 'var_ying_out');
		source = source.replace(/varying in/g, 'var_ying_in');
		source = source.replace(/attribute in/g, 'attr_ibute_in');



		// Strip comments so we don't parse dead code
		const cleanSource = source;

		// Match: (attribute|uniform|varying) (precision)? (type) (names...);
		const declRegex = /(attribute|uniform|varying)\s+(?:(lowp|mediump|highp)\s+)?(\w+)\s+([^;]+);/g;
		
		source = cleanSource.replace(declRegex, function (match, qualifier, precision, type, namesStr) {
			let targetDef;
			if (qualifier === 'attribute') targetDef = defs.attributes;
			if (qualifier === 'uniform') targetDef = defs.uniforms;
			if (qualifier === 'varying') targetDef = defs.varyings;

			if (!targetDef) return match;

			let replacementLines = [];
			let precStr = precision ? precision + ' ' : '';
			const names = namesStr.split(',').map(n => n.trim());

			names.forEach(name => {
				// Safe array tracking (e.g. lights[4] -> lights)
				let cleanName = name.split('[')[0].trim();
				if (!targetDef[cleanName]) {
					targetDef[cleanName] = [type];
					replacementLines.push(("" + (qualifier) + " " + (precStr) + "" + (type) + " " + (name) + ";" + ""));
				}
			});

			return replacementLines.join('\n');
		});



		
		// Restore WebGL2 keywords
		source = source.replace(/var_ying_out/g, 'varying out');
		source = source.replace(/var_ying_in/g, 'varying in');
		source = source.replace(/attr_ibute_in/g, 'attribute in');


	

		source = source.replace(/\#define\s+?(\w+)\n/g, function (match) {
			//console.log("define", match);
			defs.defines[match]=true;
			return '';
		});
		return source;
	}

	function setup_defs(shader, name, parent) {
		shader.defs[name] = shader.defs[name] || {
			uniforms: {}, varyings: {}, defines: {} };

		if (name === "vertex") {
			shader.defs[name].attributes = {};
		}

		if (parent && parent.defs[name]) {
			Object.assign(shader.defs[name].uniforms, parent.defs[name].uniforms);
			Object.assign(shader.defs[name].varyings, parent.defs[name].varyings);
			Object.assign(shader.defs[name].defines, parent.defs[name].defines);
			if (name === "vertex") {
				Object.assign(shader.defs[name].attributes, parent.defs[name].attributes);
			}
		}

		if (shader[name]) {
			shader[name] = sort_defs(shader[name], shader.defs[name]);
		}

		if (parent && parent[name]) {
			let depthLevel = parent.inheritance_level || 0;
			shader[name] = shader_inheritance.extend(parent[name], shader[name] || '', depthLevel);
			//console.log("check defines", [shader.defs[name].defines, shader[name]]);
			//shader[name] = shader[name].replace('[defines]', shader.defs[name].defines.join('\n'));
			shader.inheritance_level = depthLevel + 1;
		}
	}



	shaders.parse = function (shdr) {

		const shd = {
			uuid: shdr.uuid,
			vs: shdr.vertex.trim() + '\nvoid main(){\nstart_main();\n vertex();\nend_main();\n }',
			fs: shdr.fragment.trim() + '\nvoid main(){\nstart_main();\n fragment();\nend_main();\n }'
		};


		return shd;
	};

	shaders.extend = function (shdr, source) {
		return this.create({
			source: source,
			parent: shdr
		});
	};

	// Utility to completely destroy comments immediately
	const strip_comments = function (str) {
		if (!str) return "";

		// This regex matches:
		// 1. Strings: "..." or '...' (captured and preserved)
		// 2. Multi-line comments: /* ... */
		// 3. Single-line comments: // ...
		return str.replace(
			/("(?:(?:\\.)|[^"\\])*"|'(?:(?:\\.)|[^'\\])*')|\/\*[\s\S]*?\*\/|\/\/.*/g,
			function (match, string) {
				// If it's a string literal, keep it
				return string || '';
			}
		);
	};

	shaders.create = function (def) {
		const parent = def.parent;


		// Clean everything before we even look at it
		let source = strip_comments(def.source) || "";
		let vertex = strip_comments(def.vertex) || "";
		let fragment = strip_comments(def.fragment) || "";
		let vertInfo
		if (source) {
			if (source.indexOf('[fragment-shader]') > -1) {
				let splitSource = source.split('[fragment-shader]');
				vertex = splitSource[0];
				fragment = splitSource[1];
			} else {
				// Top-Down Split on the perfectly clean source string
				vertInfo = shader_inheritance.extract_function(source, 'vertex');

				if (vertInfo) {
					vertex = source.substring(0, vertInfo.endIndex + 1);
					fragment = source.substring(vertInfo.endIndex + 1);
				
				} else {
					let fragInfo = shader_inheritance.extract_function(source, 'fragment');
					if (fragInfo) {
						fragment = source;
					} else {
						vertex = source;
						fragment = source;
					}
				}
			}
		}

		/*
		const hash = hash_str(vertex + fragment);

		if (shaders.hashes[hash]) {
			return shaders.hashes[hash];
		}
		*/
		const shader = {
			defs: {},
//			hash:hash,
			vertex: vertex,
			fragment: fragment,
			parent: parent,
			inheritance_level: parent ? (parent.inheritance_level || 0) : 0
		};
		shader.vertInfo = vertInfo;

		shader.uuid = shader.uuid || engine.guid();
		engine._shaders.set(shader.uuid, shader);
	


		setup_defs(shader, 'vertex', parent);
		setup_defs(shader, 'fragment', parent);

	//	shaders.hashes[shader.hash] = shader;
		return shader;
	};



	if (dom.sidebar$) {
		dom.sidebar$.appendChild(dom.$.div.collapseable({ heading: "UF", class$: "collapsed", $style1: "position:absolute; right:0;top:0;z-index:99990;background-color:gray" },

			(function () {

				const uiforms = dom.$.div("$$position1:absolute;width:300px;left:0;; transform-origin:left top;transform1 :scale(0.8)");
				uiforms.ids = 1;
				window.univalues = [];
				window.uiforms = uiforms;
				uiforms.oninput = function (e) {
					if (e.target.uid) {
						univalues[e.target.uid] = parseFloat(e.target.value);
						uiforms.needs_update = true;
						e.target.input.value = univalues[e.target.uid];

						engine.uniforms.set('u_float_params[' + e.target.uid + ']', univalues[e.target.uid]);


					}

				};

				uiforms.names = {};
				uiforms.add = function (uf, name) {

					uiforms.needs_update = true;

					uf.uid = uiforms.ids++;
					name = name || "u" + uf.uid;
					uf.input = dom.$.input({ value: uf.value });
					uf.input.setAttribute("style", "position:absolute;right:0;top:0;width:90px;font-size:70%");
					uiforms.appendChild(dom.$.div({ position$: "relative" }, dom.$.label(name), uf, uf.input));
					uiforms.names[name] = uf;

					univalues[uf.uid] = parseFloat(uf.value);
					engine.uniforms.set('u_float_params[' + uf.uid + ']', univalues[uf.uid]);


					return 'u_float_params[' + uf.uid + ']';
				};

				uiforms.update = function () {
					if (uiforms.needs_update) {
						for (let i = 1; i < uiforms.ids; i++) {
							engine.uniforms.set('u_float_params[' + i + ']', univalues[i]);

						}
					}
				};
				console.log("uiforms.names", uiforms.names);

				function SL(name, value, min, max, step) {
					if (uiforms.names[name]) {
						return 'u_float_params[' + uiforms.names[name].uid + ']';
					}
					const i$ = dom.$.input({ type: "range", min: min, max: max, value: value, step, width$: "100%" });
					i$.value = value;
					return uiforms.add(i$, name);
				}

				window.SL = SL;
				console.log("UFO");

				return uiforms;
			})()
		));
  }
	

	function create_program(gl, vshdr, fshdr, doValidate) {
		let prog = gl.createProgram();
		gl.attachShader(prog, vshdr);
		gl.attachShader(prog, fshdr);
		gl.linkProgram(prog);

		if (!gl.getProgramParameter(prog, 35714)) {
			console.warn("Error creating shader program.", gl.getProgramInfoLog(prog));
			gl.deleteProgram(prog); return null;
		}
		if (doValidate) {
			gl.validateProgram(prog);
			if (!gl.getProgramParameter(prog, 35715)) {
				console.warn("Error validating program", gl.getProgramInfoLog(prog));
				gl.deleteProgram(prog); return null;
			}
		}
		gl.detachShader(prog, vshdr);
		gl.detachShader(prog, fshdr);
		gl.deleteShader(fshdr);
		gl.deleteShader(vshdr);
		return prog;
	}

	function create_shader_gl(gl, src, type) {
		let shdr = gl.createShader(type);
		gl.shaderSource(shdr, src);
		gl.compileShader(shdr);

		if (!gl.getShaderParameter(shdr, GL_COMPILE_STATUS)) {
			this.compiled_error = gl.getShaderInfoLog(shdr);
			const lines = src.split('\n');
			let s = this.compiled_error;
			let l = s.replace('ERROR: ', '').trim();
			let i = l.indexOf(":");
			l = l.substr(i + 1, s.indexOf(":", i + 1) - 2).trim();
			console.warn(s, lines.slice(Math.max(0, parseInt(l) - 50), parseInt(l) + 50).join('\n'));
			engine.error = true;
			gl.deleteShader(shdr);
			return null;
		}
		return shdr;
	}

	let collect_uniforms_and_attributes = (function () {

		let attributes_types = {
			5126: [Float32Array, 1],//'float',
			35664: [Float32Array, 2],// 'vec2',
			35665: [Float32Array, 3], //'vec3',
			35666: [Float32Array, 4], //'vec4'          
		}

		function add_uniform_to_shader(gl, shdr, name, type) {
			let location = gl.getUniformLocation(shdr.program, name);
			shdr.uniforms[name] = { location: location, type: type };
		}

		return function (gl, shdr) {
			let i = 0, a = 0, info;
			shdr.uniforms = {};
			shdr.all_uniforms = [];
			for (i = 0; i < gl.getProgramParameter(shdr.program, 35718); i++) {
				info = gl.getActiveUniform(shdr.program, i);
				if (info.size > 1) {
					for (a = 0; a < info.size; a++) {
						add_uniform_to_shader(gl, shdr, info.name.replace('[0]', '[' + a + ']'), info.type);
					}
				} else if (info.size === 1) {
					add_uniform_to_shader(gl, shdr, info.name, info.type);
				}
			}

			shdr.attributes = {};
			shdr.all_attributes = [];
			for (i = 0; i < gl.getProgramParameter(shdr.program, 35721); i++) {
				info = gl.getActiveAttrib(shdr.program, i);
				if (info.name.startsWith("gl_")) continue;   // built-ins (gl_InstanceID, gl_VertexID) have no attribute location
				// console.log([info.name, info]);
				shdr.attributes[info.name] = {
					name: info.name, location: gl.getAttribLocation(shdr.program, info.name),
					type: info.type, hname: hash_str(info.name)
				};
				shdr.all_attributes.push(shdr.attributes[info.name]);
			}


		}
	})();

	const uniforms_write_func = {
		5126: ['uniform1f', 2],
		35664: ['uniform2fv', 2],
		35665: ['uniform3fv', 2],
		35666: ['uniform4fv', 2],
		35678: ['uniform1i', 2],
		35680: ['uniform1i', 2],
		35682: ['uniform1i', 2],//sampler2DShadow
		35675: ['uniformMatrix3fv', 3],
		35676: ['uniformMatrix4fv', 3],
		35670: ['uniform1i', 2],
		'float': 5126,
		'vec2': 35664,
		'vec3': 35665,
		'vec4': 35666
	};
	// SL(name, value, min, max, step) is what FL("name", value, min, max, step) in a shader becomes: a slider in the sidebar's "UF" panel (above) when a page has a sidebar. With none it is a dummy that returns the default as a GLSL
	// float (a negative one in parentheses, so that `a - FL(...)` stays `a - (-0.5)`): the shader has its constant and nothing tunes it.
	if (typeof window.SL !== "function") window.SL = function SL(name, value) { const s = value % 1 === 0 ? value.toFixed(1) : String(value); return value < 0 ? "(" + s + ")" : s; };
	var fl_regex = /FL\s*\(\s*"([^"]+)"\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)/g;

	function parse_fl(src) {
		src = src.replace(fl_regex, function (match, name, p1, p2, p3, p4) {
			return SL(name, parseFloat(p1), parseFloat(p2), parseFloat(p3), parseFloat(p4))
		});
		return src;
	}

	shaders.setup_shader_uniforms = function (shdr) {
		Object.values(shdr.uniforms).forEach(function (uni) {

			let func = uniforms_write_func[uni.type];
			if (func == undefined) {
				console.log("func undefined", uni);
			}

			if (func[1] === 3)
				uni.params = [uni.location, false, undefined];
			else if (func[1] === 2) {
				uni.params = [uni.location, undefined];
			}
			uni.func = gl[func[0]];
		});
		shdr.set_uniform = function (id, value) {
			const uni = this.uniforms[id];
			if (uni) {
				uni.params[uni.params.length - 1] = value;
				uni.func.apply(gl, uni.params);

				return true;
			}
			return false;
		}
		return shdr;
	}

	shaders.compile = function compile(shdr, native) {

		
		let vshdr, fshdr;
		Object.assign(shdr, {
			vs: shdr.vertex.trim() + '\nvoid main(){\nstart_main();\n vertex();\nend_main();\n }',
			fs: shdr.fragment.trim() + '\nvoid main(){\nstart_main();\n fragment();\nend_main();\n }'
		});

		shdr.vs = parse_fl(shdr.vs);
		shdr.fs = parse_fl(shdr.fs);
		if (shdr.defs) {
			if (shdr.defs['fragment']) {
				shdr.fs = shdr.fs.replace('[defines]', Object.keys(shdr.defs['fragment'].defines).join('\n'))
			}
			if (shdr.defs['vertex']) {
				shdr.vs = shdr.vs.replace('[defines]', Object.keys(shdr.defs['vertex'].defines).join('\n'))
			}
		}



		const hash = hash_str(shdr.vs + shdr.fs);
		const shsh = shaders.hashes[hash];
		if (shsh) {
			shdr.program = shsh.program;
			shdr.all_uniforms = shsh.all_uniforms;
			shdr.all_attributes = shsh.all_attributes;
			shdr.uniforms = shsh.uniforms;
			shdr.hash = shsh.hash;
		}
		else {
			console.log("shaders.compile", [shdr]);
			vshdr = create_shader_gl.call(this, gl, shdr.vs, GL_VERTEX_SHADER);
			if (!vshdr) {
				shdr.compiled_error = this.compiled_error;
				return false;
			}
			fshdr = create_shader_gl.call(this, gl, shdr.fs, GL_FRAGMENT_SHADER);
			if (!fshdr) {
				gl.deleteShader(vshdr);
				shdr.compiled_error = this.compiled_error;
				return false;
			}

			shdr.program = create_program(gl, vshdr, fshdr, !true);
			if (shdr.program == null) {
				console.error(shdr);
				throw new Error("Failed program");
			}
			gl.useProgram(shdr.program);
			collect_uniforms_and_attributes(gl, shdr);
			gl.useProgram(null);
			
			shdr.all_uniforms = Object.keys(shdr.uniforms).map(function (u, i) {
				return u;
			});
			shaders.hashes[hash] = shdr;
			shdr.hash = hash;
		}
		
		shdr.compiled_error = undefined;
		shdr.compiled = true;


		
		
		return shdr;
	};









	return shaders;
})();



engine.textures = (function () {
	const texture_manager = {};


	let cube_map_texture_sequence = [
		GL_TEXTURE_CUBE_MAP_NEGATIVE_X, GL_TEXTURE_CUBE_MAP_POSITIVE_X,
		GL_TEXTURE_CUBE_MAP_NEGATIVE_Y, GL_TEXTURE_CUBE_MAP_POSITIVE_Y,
		GL_TEXTURE_CUBE_MAP_NEGATIVE_Z, GL_TEXTURE_CUBE_MAP_POSITIVE_Z
	];

	function update_sub_texture(tex, x, y, z, w, h, d, source) {

		let new_texture = false;
		if (tex.gl_texture === null) {
			tex.gl_texture = gl.createTexture();
			new_texture = true;
		}
		if (tex.update_source === true || tex.update_parameters === true || new_texture === true || source) {
			gl.bindTexture(tex.target, tex.gl_texture);
		}

		if (new_texture || tex.update_parameters === true) {
			//

			gl.texParameteri(tex.target, GL_TEXTURE_WRAP_S, tex.wrap_s);
			gl.texParameteri(tex.target, GL_TEXTURE_WRAP_T, tex.wrap_t);
			gl.texParameteri(tex.target, GL_TEXTURE_MAG_FILTER, tex.mag_filter);
			gl.texParameteri(tex.target, GL_TEXTURE_MIN_FILTER, tex.min_filter);

			tex.update_parameters = false;
		}

		if (new_texture) {
			if (tex.target === GL_TEXTURE_2D_ARRAY) {
				gl.texImage3D(tex.target, 0, tex.internal_format || tex.format, tex.width, tex.width, tex.depth, 0, tex.format, tex.format_type, null);
			}
			else {

				gl.texImage2D(tex.target, 0, tex.internal_format, tex.width, tex.height, 0, tex.format, tex.format_type, null);
			}


		}

		if (source !== null) {
			//		console.log("new_texture", new_texture, tex.gl_texture);
			if (tex.target === GL_TEXTURE_2D) {
				gl.pixelStorei(GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL, tex.pre_multiply_alpha);
				gl.pixelStorei(GL_PACK_ALIGNMENT, tex.pack_alignment);
				gl.pixelStorei(GL_UNPACK_ALIGNMENT, tex.unpack_alignment);
				gl.pixelStorei(GL_UNPACK_FLIP_Y_WEBGL, tex.flip_y);
				//console.log([tex, x, y, z, w, h, d, tex.format, tex.format_type, source]);
				gl.texSubImage2D(tex.target, 0, x, y, w, h, tex.format, tex.format_type, source);

			}
			else if (tex.target === GL_TEXTURE_2D_ARRAY) {
				gl.pixelStorei(GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL, tex.pre_multiply_alpha);
				gl.pixelStorei(GL_PACK_ALIGNMENT, tex.pack_alignment);
				gl.pixelStorei(GL_UNPACK_ALIGNMENT, tex.unpack_alignment);
				gl.pixelStorei(GL_UNPACK_FLIP_Y_WEBGL, tex.flip_y);
				gl.texSubImage3D(tex.target, 0, x, y, z, w, h, d, tex.format, tex.format_type, source);



			}

			if (tex.mipmap) {
				gl.generateMipmap(tex.target);
			}
			tex.version++;
		}
		

		gl.bindTexture(tex.target, null);

	}

	function update_texture(tex) {
		let new_texture = false;
		if (tex.gl_texture === null) {
			tex.gl_texture = gl.createTexture();
			new_texture = true;
		}
		if (tex.update_source === true || tex.update_parameters === true || new_texture === true) {
			gl.bindTexture(tex.target, tex.gl_texture);
		}

		if (new_texture || tex.update_parameters === true) {
			gl.texParameteri(tex.target, GL_TEXTURE_WRAP_S, tex.wrap_s);
			gl.texParameteri(tex.target, GL_TEXTURE_WRAP_T, tex.wrap_t);
			gl.texParameteri(tex.target, GL_TEXTURE_MAG_FILTER, tex.mag_filter);
			gl.texParameteri(tex.target, GL_TEXTURE_MIN_FILTER, tex.min_filter);
			// tex.anisotropy (opt in, e.g. 8): the filter keeps the detail of ground seen at a grazing angle, where trilinear alone blurs it (the extension is optional: without it the texture is trilinear)
			if (tex.anisotropy) {
				const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
				if (aniso) gl.texParameterf(tex.target, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(tex.anisotropy, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
			}

			tex.update_parameters = false;
		}

		if (new_texture) {
			if (tex.target === GL_TEXTURE_2D_ARRAY) {
				gl.texImage3D(tex.target, 0, tex.internal_format || tex.format, tex.width, tex.height / tex.depth, tex.depth, 0, tex.format, tex.format_type, null);

			}
			else {
				gl.texImage2D(tex.target, 0, tex.internal_format, tex.width, tex.height, 0, tex.format, tex.format_type, null);

			}

		}

		if (tex.update_source === true) {

			const source = tex.source;
			//tex.source = null;
			if (source) {
				gl.pixelStorei(GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL, tex.pre_multiply_alpha);
				gl.pixelStorei(GL_PACK_ALIGNMENT, tex.pack_alignment);
				gl.pixelStorei(GL_UNPACK_ALIGNMENT, tex.unpack_alignment);
				gl.pixelStorei(GL_UNPACK_FLIP_Y_WEBGL, tex.flip_y);

				if (tex.target === GL_TEXTURE_2D) {
					if (source.src || source.getContext) {
						gl.texImage2D(tex.target, 0, tex.format, tex.format, tex.format_type, source);
						tex.width = source.naturalWidth || (source.width);
						tex.height = source.naturalHeight || (source.height);
						//console.log("source", [source]);
						if (source.free) source.free();
					}
					else {
						//console.log("gl.texImage2D", tex);
						gl.texImage2D(tex.target, 0, tex.internal_format, tex.width, tex.height, 0, tex.format, tex.format_type, source);
					}
				}
				else if (tex.target === GL_TEXTURE_CUBE_MAP) {
					if (source && source.length) {
						for (let i = 0; i < source.length; i++) {
							gl.texImage2D(cube_map_texture_sequence[i], 0, tex.format, tex.format, tex.format_type, source[i]);
						}
					}
					else {
						for (i = 0; i < cube_map_texture_sequence.length; i++) {
							gl.texImage2D(cube_map_texture_sequence[i], 0, tex.format, tex.width, tex.height, 0, tex.format, tex.format_type, null);
						}
					}
				}
				else if (tex.target === GL_TEXTURE_2D_ARRAY) {
					//gl.texImage3D(GL_TEXTURE_2D_ARRAY, 0, tex.format, tex.height / tex.depth, tex.width, tex.depth, 0, tex.format, tex.format_type, source);

					const cellWidth = tex.width;
					const cellHeight = tex.height / tex.depth;
					for (let layerIndex = 0; layerIndex < tex.depth; layerIndex++) {
						gl.texSubImage3D(
							GL_TEXTURE_2D_ARRAY,
							0,                          // level
							0, 0, layerIndex,           // xoffset, yoffset, zoffset (layer)
							cellWidth, cellHeight,      // width, height
							1,                          // depth
							tex.format, tex.format_type,
							source,                        // source image
							cellWidth,            // srcX offset in image
							layerIndex * cellHeight    ,        // srcY offset in image

						);
					}



					if ((source.src || source.getContext)) {
						tex.width = source.width || source.videoWidth;
						tex.height = source.height || source.videoHeight;
						if (source.free) source.free();
					}
				}
				tex.version++;
				if (tex.mipmap) {
					gl.generateMipmap(tex.target);
				}
				if (tex.on_update) {
					tex.on_update();
				}

			}
			else {
				if (tex.target === GL_TEXTURE_2D_ARRAY) {
					gl.texImage3D(tex.target, 0, tex.internal_format || tex.format, tex.width, tex.height / tex.depth, tex.depth, 0, tex.format, tex.format_type, null);

				}
				else {
					gl.texImage2D(tex.target, 0, tex.internal_format, tex.width, tex.height, 0, tex.format, tex.format_type, null);
				}


			}

			gl.bindTexture(tex.target, null);

		}

		tex.update_source = false;


	}

	const update_texture_from_url = (function () {
		const free = [];
		const loading = {};
		console.log("update_texture_from_url", [free, loading]);
		const cmg = dom.create_canvas(1, 1);


		function update_tex_from_img(img) {



			for (let i = 0; i < img.reqs.length; i++) {
				const rq = img.reqs[i];
				rq.tex.source = img;
				rq.tex.update_source = true;
				rq.tex.url = img.src;

				if (rq.ww !== undefined) {
					if (rq.sww > 0) {
						cmg.set_size(rq.ww, rq.hh);
						cmg.ctx.drawImage(img, rq.sxx, rq.syy, rq.sww, rq.shh, 0, 0, rq.ww, rq.hh);
						update_sub_texture(rq.tex, rq.xx, rq.yy, rq.zz, rq.ww, rq.hh, rq.dd, cmg);
					}
					else {
						update_sub_texture(rq.tex, rq.xx, rq.yy, rq.zz, rq.ww, rq.hh, rq.dd, img);
					}
				}
				else {
					update_texture(rq.tex);
				}
			}


			img.reqs.length = 0;
			img.tex = undefined;
			img.onload = undefined;
			delete loading[img.hrl];
			free.push(img)
		}

		function img_loaded() {
			update_tex_from_img(this);
		}
		// update_texture_from_url(tex, str, vx, vy, vz, vw, vh, vd);
		function update_texture_from_url(tex, url, x, y, z, w, h, d, sx, sy, sw, sh) {
			const hrl = hash_str(url);

			let img = loading[hrl];
			if (!img) {
				if (free.length > 0) {
					img = free.pop();
				}
				else {
					img = new Image();
					img.crossOrigin = "Anonymous";
					img.reqs = [];
				}
			}

			img.reqs.push({
				tex: tex,
				xx: x,
				yy: y,
				zz: z,
				ww: w,
				hh: h,
				dd: d,
				sxx: sx,
				syy: sy,
				sww: sw,
				shh: sh,
			});

			if (img.src != url) {
				img.onload = img_loaded;
				img.src = url;
				img.url = url;
				img.hrl = hrl;
				loading[hrl] = img;
				console.log("loading tex", [hrl, url, img]);
			}


		}


		return update_texture_from_url;

	})();

	engine.update_texture_source = function (tex, source) {
		tex.source = source;
		tex.update_source = true;
		return update_texture(tex);
  }
	engine.update_texture = update_texture;
	engine.update_sub_texture = update_sub_texture;
	engine.update_texture_from_url = update_texture_from_url;


	texture_manager.from_img = function (img, def) {
		def = def || {};


		def.target = def.target || GL_TEXTURE_2D;

		def.active_side = def.active_side || GL_TEXTURE_2D;
		def.wrap_s = def.wrap_s || def.clamp ? GL_CLAMP_TO_EDGE : GL_REPEAT;
		def.wrap_t = def.wrap_t || def.clamp ? GL_CLAMP_TO_EDGE : GL_REPEAT;
		def.min_filter = def.min_filter || def.filter ? def.filter : GL_LINEAR;
		def.mag_filter = def.mag_filter || def.filter ? def.filter : GL_LINEAR;
		def.format = def.format || GL_RGBA;
		def.format_type = def.format_type || GL_UNSIGNED_BYTE;
		def.internal_format = def.internal_format || GL_RGBA;
		def.pack_alignment = def.pack_alignment || 4;
		def.unpack_alignment = def.unpack_alignment || 4;
		def.mipmap = def.mipmap || false;
		def.flip_y = def.flip_y || false;
		def.pre_multiply_alpha = def.pre_multiply_alpha || false;
		def.width = def.width || 0;
		def.height = def.height || 0;
		def.depth = def.depth || 0;
		def.source = img;
		def.update_source = true;
		def.update_parameters = true
		update_texture(def);
		return def;

	}


	texture_manager.create = function (tex) {
		tex = Object.assign({}, tex || {});


		tex.target = tex.target || GL_TEXTURE_2D;

		if (tex.mipmap) {
			tex.mag_filter = tex.mag_filter || GL_LINEAR;
			tex.min_filter = tex.min_filter || GL_LINEAR_MIPMAP_LINEAR;
		}
		tex.gl_texture = null;

		tex.active_side = tex.active_side || GL_TEXTURE_2D;
		tex.wrap_s = tex.wrap_s || tex.clamp ? GL_CLAMP_TO_EDGE : GL_REPEAT;
		tex.wrap_t = tex.wrap_t || tex.clamp ? GL_CLAMP_TO_EDGE : GL_REPEAT;
		tex.min_filter = tex.min_filter || (tex.filter ? tex.filter : GL_LINEAR);
		tex.mag_filter = tex.mag_filter || (tex.filter ? tex.filter : GL_LINEAR);
		tex.format = tex.format || GL_RGBA;
		tex.format_type = tex.format_type || GL_UNSIGNED_BYTE;
		tex.internal_format = tex.internal_format || GL_RGBA;
		tex.pack_alignment = tex.pack_alignment || 4;
		tex.unpack_alignment = tex.unpack_alignment || 4;
		tex.mipmap = tex.mipmap || false;
		tex.flip_y = tex.flip_y || false;
		tex.pre_multiply_alpha = tex.pre_multiply_alpha || false;
		tex.width = tex.width || 0;
		tex.height = tex.height || tex.width;
		tex.depth = tex.depth || 0;
		tex.version = 0;

		tex.uuid = tex.uuid || engine.guid();
		tex.is_texture = true;

		engine._textures.set(tex.uuid, tex);

		if (tex.source) {
			tex.update_source = true;
			//update_texture(tex);
		}


		return tex;
	}

	texture_manager.from_url = function (url, def) {
		const tex = texture_manager.create(def);
		engine.update_texture_from_url(tex, url);
		return tex;
	};

	texture_manager.from_url_promise = function (url, def) {

		return new Promise(function (res) {
			const tex = texture_manager.from_url(url);
			tex.on_update = function () {
				res(tex);
			};

		});

		return tex;
	};

	return texture_manager;
})();


engine.render_targets = (function () {
	const render_targets = {};
	engine._render_targets = new Map();

	render_targets.create = function (fbo) {
		fbo = fbo || {};
		fbo.width = fbo.width || 1;
		fbo.height = fbo.height || fbo.width;
		fbo.resizeable = false;
		fbo.uuid = fbo.uuid || engine.guid();
		if (fbo.width <= 1 && fbo.height <= 1) {
			fbo.res_width = fbo.width;
			fbo.res_height = fbo.height;

			fbo.resizeable = true;

		}
		fbo._draw_buffers = [];
		const draw_buffers = {};
		if (fbo.color) {
			fbo._draw_buffers.push("color");
			draw_buffers["color"] = fbo.color;
		}
		if (fbo.draw_buffers) {
			for (let ke in fbo.draw_buffers) {
				fbo._draw_buffers.push(ke);
				draw_buffers[ke] = fbo.draw_buffers[ke];
			}
		}




		fbo._draw_buffers.forEach(function (ke, i) {
			const b = draw_buffers[ke];
			const bf = engine.textures.create(Object.assign({
				width: fbo.width || 1,
				height: fbo.height || 1,
				filter: GL_NEAREST,
				clamp: true,
				attachment: GL_COLOR_ATTACHMENT0 + i
			}, b));
			draw_buffers[ke] = bf;
			fbo[ke] = bf;
		});

		fbo.draw_buffers = Object.values(draw_buffers);
		if (fbo.depth) {
			fbo.depth = engine.textures.create({
				attachment: GL_DEPTH_ATTACHMENT,
				format: GL_DEPTH_COMPONENT,
				format_type: GL_UNSIGNED_INT,
				width: fbo.width || 1,
				height: fbo.height || 1,
				internal_format: GL_DEPTH_COMPONENT24,
				filter: fbo.depth.filter == undefined ? GL_NEAREST : fbo.depth.filter,
				clamp: fbo.depth.clamp == undefined ? true : fbo.depth.clamp
			});
		}
		fbo.textures = [];
		//	console.log("fbo", fbo);
		fbo.need_confirm_buffer = true;
		fbo._draw_buffers = [];

		engine._render_targets.set(fbo.uuid, fbo);
		return fbo;


	};
	render_targets.resize = function (fbo) {
		if (fbo.resizeable) {

			let width = Math.floor(fbo.res_width * engine.render_width);
			let height = Math.floor(fbo.res_height * engine.render_height);

			if (width !== fbo.width || height !== fbo.height) {
				fbo.width = width;
				fbo.height = height;
				console.warn("render_targets.resize", fbo);
				let tex;
				for (let i = 0; i < fbo.textures.length; i++) {
					tex = fbo.textures[i]
					if (tex.width !== fbo.width || tex.height !== fbo.height) {
						tex.width = fbo.width;
						tex.height = fbo.height;
						tex.update_source = true;
						engine.update_texture(tex);
					}

				}

				if (fbo.render_buffer) {
					gl.bindRenderbuffer(GL_RENDERBUFFER, fbo.render_buffer.buffer);
					gl.bindFramebuffer(GL_FRAMEBUFFER, fbo.buffer);
					gl.renderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_DEPTH_COMPONENT24, fbo.width, fbo.height);
					gl.renderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_RGBA4, fbo.width, fbo.height);
					gl.bindRenderbuffer(GL_RENDERBUFFER, null);
				}

			}


		}
	};


	render_targets.validate = function (fbo, tex) {

		fbo.valid = false;

		let status = gl.checkFramebufferStatus(GL_FRAMEBUFFER);
		// console.log("FRAMEBUFFER status (GL_FRAMEBUFFER_COMPLETE)", status,tex);

		switch (status) {
			case GL_FRAMEBUFFER_COMPLETE:
				fbo.valid = true;
				break;
			case GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
				console.log(fbo);
				throw ("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
				break;
			case GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
				console.log(fbo);
				throw ("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
				break;
			case GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
				console.log(fbo);
				throw ("Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
				break;
			case GL_FRAMEBUFFER_UNSUPPORTED:
				console.log(fbo);
				throw ("Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED");
				break;
			default:
				console.log(fbo);
				throw ("Incomplete framebuffer: " + status);
		}

	}


	render_targets.bind = function (fbo) {
		if (!fbo.buffer) {
			if (fbo.resizeable) {

				fbo.width = Math.floor(fbo.res_width * engine.render_width);
				fbo.height = Math.floor(fbo.res_height * engine.render_height);
			}
			fbo.buffer = gl.createFramebuffer();
			gl.bindFramebuffer(GL_FRAMEBUFFER, fbo.buffer);

			fbo.draw_buffers.forEach(function (tex) {
				tex.width = fbo.width;
				tex.height = fbo.height;
				tex.update_source = true;
				engine.update_texture(tex);
				gl.bindTexture(tex.target, tex.gl_texture);
				fbo.textures.push(tex);
				gl.framebufferTexture2D(GL_FRAMEBUFFER, tex.attachment, tex.active_side, tex.gl_texture, 0);
				gl.bindTexture(tex.target, null);
				render_targets.validate(fbo, tex);
				if (tex.attachment >= GL_COLOR_ATTACHMENT0 && tex.attachment < GL_COLOR_ATTACHMENT0 + 16) {
					fbo._draw_buffers.push(tex.attachment);
					fbo.need_confirm_buffer = fbo._draw_buffers.length > 0;

				}


			});
			if (fbo.depth) {
				fbo.depth.width = fbo.width;
				fbo.depth.height = fbo.height;
				engine.update_texture(fbo.depth);
				gl.framebufferTexture2D(GL_FRAMEBUFFER, fbo.depth.attachment, fbo.depth.active_side, fbo.depth.gl_texture, 0);
				render_targets.validate(fbo, fbo.depth);
				fbo.textures.push(fbo.depth);
			}
			render_targets.resize(fbo);
			if (fbo.render_buffer) {
				if (!fbo.render_buffer.buffer) {
					fbo.render_buffer.buffer = gl.createRenderbuffer();
				}
			}

			if (engine.was_resized) {
				render_targets.resize(fbo);
			}
		}
		else {
			gl.bindFramebuffer(GL_FRAMEBUFFER, fbo.buffer);
			if (engine.was_resized) {
				render_targets.resize(fbo);
			}
		}






		if (fbo.need_confirm_buffer) {
			fbo.need_confirm_buffer = false;
			//console.log("fbo.need_confirm_buffer", fbo);
			gl.drawBuffers(fbo._draw_buffers);
		}




	};





	render_targets.stack = object_stack(function (fbo) {
		if (fbo) {
			render_targets.bind(fbo);
			gl.viewport(0, 0, fbo.width, fbo.height);
		}
		else {
			gl.viewport(0, 0, engine.render_width, engine.render_height);
			gl.bindFramebuffer(GL_FRAMEBUFFER, null);
		}

	});

	return render_targets;


})();



engine.materials = (function () {

	const materials = {
		hashes: {},
		vertex_shader_header: `
#version 300 es
#define saturate(a) clamp( a, 0.0, 1.0 )
#define attribute in
#define varying out
#define texture2D texture
#define float2 vec2
#define float3 vec3
#define float4 vec4
#define lerp mix
#define PI 3.14159265358
#define WEBGL2
#define VERTEX_HEADER
[defines]
//[defines]
`,
		fragment_shader_header: `
#version 300 es\nprecision highp float;\n
precision highp sampler2DArray;
precision highp sampler2DShadow;
#define saturate(a) clamp( a, 0.0, 1.0 )
#define float2 vec2
#define float3 vec3
#define float4 vec4
#define PI 3.14159265358
#define lerp mix
#define gl_FragColor frag_color
#define varying in
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
#define texture3D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
#define WEBGL2
#define FRAGMENT_HEADER
[defines]
//[defines]
layout(location=0) out vec4 frag_color;
`,

	};
	const flags = {};

	let fi = 1;
	console.log("flags", flags);
	materials.add_flags = function (fl) {
		fl.forEach(function (f) {
			flags[f] = fi;
			fi = fi * 2;
		});
	};
	materials.flags = flags;


	materials.setup_flags = function (mat) {
		for (let k in flags) {
			if ((mat.flags & flags[k]) || mat.uniforms[k] || mat[k]) {
				mat.flags |= flags[k];
			}
		}

		return mat;
	};


	materials.add_flags([
		"enable_vertex_color",
		"enable_logdepth",
		"enable_bilboard",
		"flat_normals",
		"calculate_tbn",

		"u_baryframe_width",
		"u_alpha_test",
		"u_ao_map",
		"u_base_color_map",
		"u_emissive_color_map",
		"u_matallic_map",
		"u_roughness_map",
		"u_matallic_roughness_map",
		"u_normal_map",
		"u_diffuse_map",
		"u_alpha_map",
		"u_bones_texture",
		"u_instances_num_grid",
		"unlit"
	]);


	materials.compile = function (mat) {
		if (!mat.needs_update) return;

		//	console.log("compile mat", mat);
		let defines = '';
		let k, uvalue;

		//console.log("mat", mat);
		for (k in flags) {

			if ((mat.flags & flags[k]) || mat.uniforms[k]) {
				defines += '#define ' + k.toUpperCase() + '\n';
			}
		}



		mat.defines = defines;
		const compiler = materials.compilers[mat.compiler];
		let source = compiler(mat);


		//console.log([this]);
		source = source.replace('[vertex_shader_header]', this.vertex_shader_header);
		source = source.replace('[fragment_shader_header]', this.fragment_shader_header);
		source = source.replace(/\/\/\[defines\]/g, defines);

		const hash = hash_str(source);


		if (!materials.hashes[hash]) {

			materials.hashes[hash] = engine.shaders.create({
				source: source,
			});
			if (mat.extend_shader) materials.hashes[hash] = engine.shaders.extend(materials.hashes[hash], mat.extend_shader);
		}

		let shader = materials.hashes[hash];


		if (mat.shader) {
			if (Object.prototype.toString.call(mat.shader) === "[object String]") {
				if (Object.prototype.toString.call(mat.parent_shader) === "[object String]") {
					shader = engine.shaders.extend(shader, mat.parent_shader);
					shader = shader.replace(/\/\/\[defines\]/g, defines + '\n//[defines]');
					mat.shader = engine.shaders.extend(shader, mat.shader);
				}
				else mat.shader = engine.shaders.extend(mat.parent_shader || shader, mat.shader);
			}
		}
		else mat.shader = shader;
		mat.needs_update = false;

		return mat;

	}


	materials.compilers = {
		"default": (function () {
			function flat(mat) {
				mat.uniforms = Object.assign({
					u_base_color: math.vec4(1, 1, 1, 1),
				}, mat.uniforms || {});
				return `
[vertex_shader_header]
//[defines]
attribute vec3 a_position;
attribute vec2 a_uv;
uniform vec4 u_camera_bounds;
uniform vec3 u_camera_position;
varying vec2 v_uv;
varying vec3 v_position_world;

uniform mat4 u_view_projection_matrix;
uniform mat4 u_model_matrix;
#ifdef ENABLE_VERTEX_COLOR
	varying vec4 v_color;
	attribute vec4 a_color;
#endif
void start_main(){}
void end_main(){
	#ifdef ENABLE_LOGDEPTH
			float log_z = log2( max( 0.00001, gl_Position.w+2.0) ) * u_camera_bounds[2]-1.0;
			log_z *= gl_Position.w;
			gl_Position.z=mix(gl_Position.z,log_z,1.0);
	#endif

}

#ifdef U_INSTANCES_NUM_GRID
	uniform float u_instances_num_grid;
	uniform vec3 u_instances_num_grid_size;
	uniform vec3 u_instances_num_grid_pos;
#endif

void vertex(){
v_uv=a_uv;
vec3 pos=a_position;
#ifdef U_INSTANCES_NUM_GRID
		float _n = mod(float(gl_InstanceID) + 1.0,u_instances_num_grid);
		pos.xyz+=(u_instances_num_grid_pos + vec3(fract(_n * 0.7548776662466927),fract(_n* 0.125698402909980532), fract(_n * 0.5698402909980532)) * u_instances_num_grid_size);

#endif
v_position_world=pos;
gl_Position=u_view_projection_matrix*(vec4(pos,1));
#ifdef ENABLE_VERTEX_COLOR
	v_color=a_color;
#endif


}
[fragment_shader_header]
//[defines]

uniform vec3 u_camera_position;
varying vec3 v_position_world;
varying vec2 v_uv;
void start_main(){}
void end_main(){}
varying vec2 v_uv;


#ifdef U_BASE_COLOR_MAP
  uniform sampler2D u_base_color_map;
#endif

uniform vec4 u_base_color;
#ifdef ENABLE_VERTEX_COLOR
	varying vec4 v_color;
#endif



#ifdef U_ALPHA_TEST
uniform float u_alpha_test;
#endif


#define HAS_DISCARD
void has_discard(){
	#ifdef U_ALPHA_TEST
		if(gl_FragColor.a<u_alpha_test) discard;
	#endif
}
void fragment(){

#ifdef U_BASE_COLOR_MAP
  gl_FragColor=texture2D(u_base_color_map,v_uv);
#else
	gl_FragColor=vec4(1);
#endif

#ifdef ENABLE_VERTEX_COLOR
	gl_FragColor*=v_color;
#endif

#ifdef U_ALPHA_TEST
	if(gl_FragColor.a<u_alpha_test) discard;
#endif



}`;
			}

			return flat;
		})()
	};

	materials.setup_flags = function (mat) {
		for (let k in flags) {
			if ((mat.flags & flags[k]) || mat.uniforms[k] || mat[k]) {
				mat.flags |= flags[k];
			}
		}

		return mat;
	};

	materials.clone = function (_this, def) {
		def = def || {};
		if (def.wireframe == undefined) def.wireframe = _this.wireframe;
		const mat = materials.create(def, true);
		const uniforms = Object.assign({}, _this.uniforms);

		mat.uniforms = Object.assign(uniforms, mat.uniforms || {});
		const state = Object.assign({}, _this.state);
		mat.compiler = def.compiler || _this.compiler;
		mat.state = Object.assign(mat.state || {},state);
		mat.flags = def.flags !== undefined ? def.flags : _this.flags;
		mat.state = Object.assign(mat.state, def.state || {});

		mat.parent = _this;
		materials.setup_flags(mat);
		mat.draw_type = def.draw_type == undefined ? _this.draw_type : def.draw_type;
		if (!def.shader) {
			mat.shader = _this.shader;
    }			
		else {
			mat.parent_shader = _this.shader;
    }


		return materials.compile(mat);
	}

	materials.create = function (def, skip_compile) {
		def = def || {};
		const mat = { compiler: def.compiler || "default" };
		mat.flags = 0;
		mat.wireframe = false;
		mat.uuid = def.uuid || engine.guid();
		//Object.assign(mat, def);

		if (def.shader) {
			mat.shader = def.shader;
		}
		if (def.wireframe !== undefined) mat.wireframe = def.wireframe;

		mat.state = mat.state || {
			depthMask: true,
			depthFunc: GL_LESS,
			colorMask: true,
			cullFace: GL_BACK,
			blendFunc0: -1,
			blendFunc1: -1,
			frontFace: GL_CCW,
			blendEquationSeparate0: -1,
			blendEquationSeparate1: -1,
		};


		mat.draw_type = def.draw_type == undefined ? GL_TRIANGLES : def.draw_type;

		if (def.props) {
			Object.assign(mat, def.props);
		}

		mat.uniforms = mat.uniforms || {};
		mat.state = Object.assign(mat.state, def.state || {});
		materials.setup_flags(mat);

		mat.needs_update = true;
		if (def.uniforms) Object.assign(mat.uniforms, def.uniforms);

		engine._materials.set(mat.uuid, mat);

		if (skip_compile) return mat;
		return materials.compile(mat);
	};


	materials.compilers["pbr"] = (function () {
		engine.shaders.inherritables.push('get_a_position', 'get_tm', 'get_a_color', 'resolve_shading_attributes', 'resolve_normal_map', 'process_normal_map', 'deffered_rendering');
		function vertex_shader() {
			return `
[vertex_shader_header]
//[defines]
attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec4 a_tangent;
attribute vec2 a_uv;
attribute vec3 a_instance_a_position;
uniform float u_time;
uniform mat4 u_view_projection_matrix;
uniform mat4 u_projection_matrix;
uniform mat4 u_view_matrix;
uniform mat4 u_inverse_view_matrix;
uniform mat3 u_normal_matrix;
uniform mat4 u_model_matrix;
uniform vec4 u_camera_bounds;
uniform vec3 u_camera_position;
uniform float u_log_depthbuff_fc;
uniform vec3 u_camera_fw_vector;
uniform vec3 u_camera_sd_vector;
uniform vec3 u_camera_up_vector;
uniform float u_float_params[24];

#ifdef CALCULATE_TBN
	varying vec3 v_tangent;
	varying vec3 v_bitangent;
	varying mat3 v_tbn;
#endif

#ifdef ENABLE_LOGDEPTH
	uniform float u_log_depthbuff_fc;
	uniform float u_log_depth_ratio;
	varying float v_frag_depth;
#endif

#ifdef ENABLE_VERTEX_COLOR
	varying vec4 v_color;
	attribute vec4 a_color;
#endif

#ifdef U_SHADOW_MAP
	uniform mat4 u_shadow_view_projection_matrix;
	varying vec4 v_shadow_position;
#endif


varying vec3 v_normal_world;
varying vec3 v_normal_view;
varying vec3 v_a_position;
varying vec3 v_a_normal;
varying vec2 v_a_uv;

varying vec3 v_position_world;
varying vec3 v_position_view;
varying vec2 v_uv;

#ifdef U_BONES_TEXTURE
mat4 get_tm(float, inout mat4);
mat4 get_bone_matrix(void);

#define ROW0_U ((0.5 + 0.0) / 4.)
#define ROW1_U ((0.5 + 1.0) / 4.)
#define ROW2_U ((0.5 + 2.0) / 4.)
#define ROW3_U ((0.5 + 3.0) / 4.)

attribute vec4 a_bone_indices;
attribute vec4 a_bone_weights;

uniform sampler2D u_bones_texture;
uniform float u_num_bones;

mat4 get_tm(float boneNdx, inout mat4 tm) {
  float v = ((boneNdx + 0.5) / u_num_bones);
	tm[0]=texture2D(u_bones_texture, vec2(ROW0_U, v));
	tm[1]=texture2D(u_bones_texture, vec2(ROW1_U, v));
	tm[2]=texture2D(u_bones_texture, vec2(ROW2_U, v));
	return tm;
}

mat4 get_bone_matrix(void){
	mat4 tm = mat4(0.0, 0.0, 0.0, 0.0,0.0, 0.0, 0.0, 0.0,0.0, 0.0, 0.0, 0.0,0.0, 0.0, 0.0, 1.0);

	tm= get_tm(a_bone_indices.x,tm);
	mat4 bm=(a_bone_weights.x * tm);
  tm= get_tm(a_bone_indices.y,tm);
  bm = (bm + (a_bone_weights.y * tm));
  tm= get_tm(a_bone_indices.z,tm);
  bm = (bm + (a_bone_weights.z * tm));
  tm= get_tm(a_bone_indices.w,tm);
  bm = (bm + (a_bone_weights.w * tm));
	return bm;
}


#endif



#ifdef U_BARYFRAME_WIDTH
	attribute vec3 a_barycentric;
	varying vec3 v_barycentric;
#endif



#ifdef U_SPRITE_SHEET
vec2 sprite_sheet_uvs(vec2 uvs,vec2 sheet,float time){
	float sheet_width=1.0/sheet.x;
	float frame_index=floor(time*(1.0/(sheet.x*sheet.y)));
	uvs*=sheet.xy;
	return uvs+vec2((floor(mod(frame_index,sheet_width))*sheet.x),(floor(frame_index/sheet_width)*sheet.y));
}
#endif

vec3 get_a_position(vec3);
vec4 get_a_color(vec4);


vec4 get_a_color(vec4 color){
return color;
}

vec3 get_a_position(vec3 pos){
return pos;
}




#ifdef U_INSTANCES_NUM_GRID
	uniform float u_instances_num_grid;
	uniform vec3 u_instances_num_grid_size;
	uniform vec3 u_instances_num_grid_pos;
#endif

void start_main()
{
#ifdef U_BARYFRAME_WIDTH
v_barycentric=a_barycentric;
#endif

#ifdef ENABLE_VERTEX_COLOR
v_color =get_a_color(a_color);
#endif

v_a_position=get_a_position(a_position);


#ifdef U_INSTANCES_NUM_GRID
		float _n = mod(float(gl_InstanceID) + 1.0,u_instances_num_grid);
		v_a_position.xyz+=(u_instances_num_grid_pos + vec3(fract(_n * 0.7548776662466927),fract(_n * 0.125698402909980532), fract(_n * 0.5698402909980532)) * u_instances_num_grid_size);

#endif

v_a_normal=a_normal;
v_a_uv = a_uv;
v_uv = v_a_uv;
#ifdef U_DISPLACEMENT_MAP


#endif

#ifdef U_BONES_TEXTURE
	mat4 bm=get_bone_matrix();
	v_position_world=(u_model_matrix*(vec4(v_a_position,1.0)*bm)).xyz;
	v_normal_world=normalize((u_model_matrix*vec4(v_a_normal,0)*bm).xyz);


#else
	v_position_world =(u_model_matrix * vec4(v_a_position,1.0)).xyz;
  v_position_view = (u_view_matrix * vec4(v_position_world, 1.0)).xyz;
	v_normal_world = normalize((u_model_matrix * vec4(v_a_normal, 0.0)).xyz);
#endif


}

#ifdef U_UV_MATRIX
	uniform mat3 u_uv_matrix;
#endif


#ifdef U_SPRITE_SHEET
uniform vec3 u_sprite_sheet;
#endif

#ifdef ENABLE_LOGDEPTH
uniform float u_log_depth_alpha;
#endif
void end_main()
{

	#ifdef CALCULATE_TBN
		v_bitangent = cross( vec3 ( 0, 0, 1 ), v_normal_world );
		v_tangent = cross( v_normal_world, v_bitangent );
		v_tbn = mat3( normalize(v_tangent), normalize(v_bitangent), normalize(v_normal_world) );
	#endif

	#ifdef ENABLE_LOGDEPTH
			float log_z = log2( max( 0.00001, gl_Position.w+2.0) ) * u_camera_bounds[2]-1.0;
			log_z *= gl_Position.w;
//control logrithm depth at runtime;
			gl_Position.z=mix(log_z,gl_Position.z,u_log_depth_alpha);
	#endif
	
	#ifdef U_UV_MATRIX
		v_uv= (u_uv_matrix*vec3(v_uv,0)).xy;
	#endif

	#ifdef U_SHADOW_MAP
		v_shadow_position=(u_shadow_view_projection_matrix*vec4(v_position_world,1.0));
	#endif

	#ifdef U_SPRITE_SHEET
		v_uv=sprite_sheet_uvs(v_uv,u_sprite_sheet.xy,fract(u_time*u_sprite_sheet.z));
	#endif

}

`;
		}

		function fragment_shader() {
			return `
[fragment_shader_header]
uniform vec4 u_camera_bounds;
uniform vec3 u_camera_position;
//[defines]
#define MEDIUMP_FLT_MAX    65504.0
#define MEDIUMP_FLT_MIN    0.00006103515625
#define FLT_EPS            MEDIUMP_FLT_MIN
uniform float u_float_params[24];
#define USE_MAT
struct Material {

	vec3 normal_view;
  vec4 tangent_view;
  vec3 position_world;
  vec3 position_view;
  vec3 eye_dir_view;
  vec3 eye_dir_world;
  vec3 normal_world; // N, world space
  vec3 view_world; // V, view vector from position to camera, world space
  float NdotV;
	float frag_distance;
	vec2 uv;
	float facing;
  vec4 base_color;
  vec3 emissive_color;
  float opacity;
	float normal_scale;
	float ao;
  float roughness; // roughness value, as authored by the model creator (input to shader)
  float metallic; // metallic value at the surface
  float linear_roughness; // roughness mapped to a more linear change in the roughness (proposed by [2])
  vec3 f0; // Reflectance at normal incidence, specular color
	vec3 Fr;
  float clear_coat_linear_roughness;
  vec3 clear_coat_normal;
  vec3 reflection_world;
  vec3 direct_color;
  vec3 diffuse_color; // color contribution from diffuse lighting
  vec3 indirect_diffuse; // contribution from IBL light probe and Ambient Light
  vec3 indirect_specular; // contribution from IBL light probe and Area Light
};


struct Light {
	vec3 direction;
	vec3 color;
	float illuminated;
	float attenuation;
};

uniform Light directional_lights[2];
uniform Light ambient_lights[2];

void apply_surface_shading(inout Material, Light );

vec3 specular_reflection(vec3 specular_color, float HdotV) {
return specular_color + (1.0 - specular_color) * pow(1.0 - HdotV,5.0);
}

// GGX, Trowbridge-Reitz
// Same as glTF2.0 PBR Spec
float microfacet_distribution(float linear_roughness, float NdotH) {
  float a2 = linear_roughness * linear_roughness;
  float NdotH2 = NdotH * NdotH;

  float nom = a2;
  float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;
  if (denom > 0.0) {
    return nom / denom;
  } else {
    return 1.0;
  }
}
// Smith Joint GGX
// Sometimes called Smith GGX Correlated
// Note: Vis = G / (4 * NdotL * NdotV)
// see Eric Heitz. 2014. Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs. Journal of Computer Graphics Techniques, 3
// see Real-Time Rendering. Page 331 to 336.
// see https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing(specularg)
float visibility_occlusion(float linear_roughness, float NdotL, float NdotV) {
  float linear_roughness_sq = linear_roughness * linear_roughness;

  float GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - linear_roughness_sq) + linear_roughness_sq);
  float GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - linear_roughness_sq) + linear_roughness_sq);

  float GGX = GGXV + GGXL;
  if (GGX > 0.0) {
		return 0.5 / GGX;
  }
  return 0.0;
}
void apply_ambient_light(inout Material mat,Light light) {
 mat.Fr = mat.ao  * light.color;
  mat.indirect_diffuse += mat.ao * (mat.diffuse_color * light.color);
}

void apply_surface_shading(inout Material mat, Light light) {


  vec3 N = mat.normal_world;
  vec3 V = mat.view_world;
  vec3 L = normalize(light.direction);
  vec3 H = normalize(V + L);

  float NdotV = saturate(abs(dot(N, V)) + FLT_EPS);
  float NdotL = saturate(dot(N, L));

	mat.Fr+=vec3(NdotL);
  if (NdotL <= 0.0) return;

  float NdotH = saturate(dot(N, H));
  float LdotH = saturate(dot(L, H));
  float HdotV = max(0.0, dot(H, V));

  vec3 F = specular_reflection(mat.f0, HdotV);

  float D = microfacet_distribution(mat.linear_roughness, NdotH);
  float Vis = visibility_occlusion(mat.linear_roughness, NdotL, NdotV);

  //TODO: switch to linear colors
  vec3 light_color =light.color;

  vec3 Fd = (1.0 / PI) * mat.diffuse_color;
  vec3 Fr = F * Vis * D;

  //TODO: energy compensation
  float energy_compensation = 1.0;

  #ifdef USE_CLEAR_COAT
    float Fcc;
    float clearCoat = clearCoatBRDF(mat, H, NdotH, LdotH, Fcc);
    float attenuation = 1.0 - Fcc;

    vec3 color = (Fd + Fr * (energy_compensation * attenuation)) * attenuation * NdotL;

    // direct light still uses NdotL but clear coat needs separate dot product when using normal map
    // if only normal map is present not clear coat normal map, we will get smooth coating on top of bumpy surface
    #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
      float clearCoatNoL = saturate(dot(mat.clear_coat_normal, light.direction));
      color += clearCoat * clearCoatNoL;
    #else
      color += clearCoat * NdotL;
    #endif
  #else
    vec3 color = (Fd + Fr * energy_compensation) * NdotL;
  #endif

  mat.direct_color += (color * light_color) * ( light.attenuation * light.illuminated);
}



#define MIN_ROUGHNESS 0.0089

#ifdef CALCULATE_TBN
	varying vec3 v_tangent;
	varying vec3 v_bitangent;
	varying mat3 v_tbn;
#endif

#ifdef U_NORMAL_MAP

	mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv) {
		// get edge vectors of the pixel triangle
		highp vec3 dp1 = dFdx(p);
		highp vec3 dp2 = dFdy(p);
		highp vec2 duv1 = dFdx(uv);
		highp vec2 duv2 = dFdy(uv);

		// solve the linear system
		vec3 dp2perp = cross(dp2, N);
		vec3 dp1perp = cross(N, dp1);
		vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
		vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

		// construct a scale-invariant frame
		float invmax = 1.0 / sqrt(max(dot(T,T), dot(B,B)));
		return mat3(normalize(T * invmax), normalize(B * invmax), N);
	}

	vec3 perturb_normal(vec3 map, vec3 N, vec3 V, vec2 texcoord) {
		#ifdef CALCULATE_TBN
			return normalize(v_tbn * map);
		#else
			return normalize(cotangent_frame(N, -V, texcoord) * map);
		#endif
	}
#endif



float A = 0.15;
float B = 0.50;
float C = 0.10;
float D = 0.20;
float E = 0.02;
float F = 0.30;
float W = 11.2;

vec3 uncharted_tonemap(vec3 x) {
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}
vec3 tonemap_uncharted(vec3 color) {
  float exposure_bias = 2.0;
  vec3 curr = uncharted_tonemap(exposure_bias * color);
  vec3 white_scale = 1.0 / uncharted_tonemap(vec3(W));
  return curr * white_scale;
}

#ifdef ENABLE_LOGDEPTH
	varying float v_frag_depth;
#endif


varying vec3 v_normal_world;
varying vec3 v_normal_view;
varying vec3 v_a_position;
varying vec3 v_position_world;
varying vec3 v_position_view;
varying vec2 v_uv;

uniform vec4 u_base_color;
uniform float u_normal_scale;
uniform float u_reflectance;
uniform float u_metallic;
uniform float u_roughness;
uniform float u_glossiness;
uniform vec3 u_emissive_color;
uniform vec3 u_diffuse;
uniform mat4 u_inverse_view_matrix;
uniform mat4 u_view_matrix;


#ifdef U_ALPHA_TEST
uniform float u_alpha_test;
#endif

#ifdef U_NORMAL_MAP
  uniform sampler2D u_normal_map;
#endif

#ifdef U_BASE_COLOR_MAP
  uniform sampler2D u_base_color_map;
#endif
#ifdef U_ROUGHNESS_MAP
  uniform sampler2D u_roughness_map;
#endif
#ifdef U_AO_MAP
  uniform sampler2D u_ao_map;
#endif
#ifdef U_METALLIC_MAP
  uniform sampler2D u_metallic_map;
#endif

#ifdef U_METALLIC_ROUGHNESS_MAP
  uniform sampler2D u_matallic_roughness_map;
#endif



#ifdef U_ALPHA_MAP
  uniform sampler2D u_alpha_map;
#endif

Material mat;

#ifdef ENABLE_VERTEX_COLOR
	varying vec4 v_color;
#endif

#ifdef U_SHADOW_MAP
	uniform sampler2D u_shadow_map;
	varying vec4 v_shadow_position;
	float calculate_shadow() {
			// 1. Perspective divide to get NDC (-1 to 1)
			vec3 projCoords = v_shadow_position.xyz / v_shadow_position.w;

			// 2. Transform to [0, 1] range for texture sampling and depth comparison
			projCoords = projCoords * 0.5 + 0.5;

//gl_FragColor = mix(gl_FragColor,vec4(projCoords.xyz, 1.0),0.5);

			// 3. Get the closest depth value from the light's perspective
			float closestDepth = texture2D(u_shadow_map, projCoords.xy).r;

			// 4. Get the current depth of this fragment from the light's perspective
			float currentDepth = projCoords.z;

			// 5. Check if the fragment is in shadow (with a small bias to fix "Shadow Acne")
			float bias = 0.005;
			float shadow = currentDepth - bias > closestDepth  ? 0.5 : 1.0;

			float withinLight = step(projCoords.z, 1.0);
			shadow = mix(1.0, shadow, withinLight);

			return shadow;
	}

float get_shadow(vec4 shadow_pos){

			vec3 shadow_map_coords =shadow_pos.xyz/shadow_pos.w;

			shadow_map_coords.xyz = shadow_map_coords.xyz * 0.5 + 0.5;

			float f=step(shadow_map_coords.x,1.0)*step(shadow_map_coords.y,1.0)*step(shadow_map_coords.z,1.0);
			f*=step(0.0,shadow_map_coords.x)*step(0.0,shadow_map_coords.y)*step(0.0,shadow_map_coords.y);



			vec2 coords= shadow_map_coords.xy*vec2(textureSize(u_shadow_map,0));
			vec2 texel=vec2( 1.0/2048.);
			float shadow = 0.0;
			const float NUM_SAMPLES =3.0;
			const float SAMPLES_START = (NUM_SAMPLES - 1.0) / 2.0;
			const float NUM_SAMPLES_SQUARED = NUM_SAMPLES * NUM_SAMPLES;

			for (float y = -SAMPLES_START; y <= SAMPLES_START; y += 1.0)
			{
				for (float x = -SAMPLES_START; x <= SAMPLES_START; x += 1.0)
				{
					shadow+=step(shadow_map_coords.z -0.000000185, texture2D(u_shadow_map, vec2(coords+vec2(x, y))*texel).r);
				}
			}



			return  (f-(shadow/ NUM_SAMPLES_SQUARED))*f;
}

#endif

void setup_material(inout Material);
#ifdef U_UV_SCALE
  uniform vec2 u_uv_scale;
#endif
void setup_material(inout Material mat){
	mat.facing= float(gl_FrontFacing) * 2.0 - 1.0;
	mat.uv=v_uv;
	#ifdef U_UV_SCALE
	mat.uv=v_uv*u_uv_scale;
	#endif
	mat.base_color=u_base_color;
	mat.opacity =u_base_color.a;
	mat.normal_scale =u_normal_scale;
	mat.position_world = v_position_world;
	mat.position_view = v_position_view;
	mat.normal_view = normalize(v_normal_view);
	mat.normal_world = normalize(v_normal_world);
	mat.eye_dir_view = normalize(v_position_view-u_camera_position);
	mat.eye_dir_world = vec3(u_view_matrix * vec4(mat.eye_dir_view, 0.0));
	mat.indirect_diffuse = vec3(0.0);
	mat.indirect_specular = vec3(0.0);
	mat.emissive_color=u_emissive_color;
	mat.direct_color=vec3(0);
	#ifdef FLAT_NORMALS
		mat.normal_world  = normalize(cross(dFdx(mat.position_world), dFdy(mat.position_world)));
	#endif

}

void resolve_base_color(inout Material);

void resolve_base_color(inout Material mat){
	#ifdef U_BASE_COLOR_MAP
		vec4 texel = texture2D(u_base_color_map, mat.uv);
		mat.base_color=texel;
		mat.opacity = mat.opacity* texel.a;
	#endif

	#ifdef ENABLE_VERTEX_COLOR
		mat.base_color.rgb *=v_color.rgb;
		mat.opacity *=v_color.a;
	#endif
}
void resolve_normal_map(inout Material);
void process_normal_map(inout Material ,vec3,vec2);

void process_normal_map(inout Material mat,vec3 normal_map,vec2 uv){
	#ifdef U_NORMAL_MAP
		mat.clear_coat_normal=normal_map;
		normal_map.y *= mat.normal_scale;
		normal_map = normalize(normal_map);
		vec3 N = normalize(mat.normal_world);
		vec3 V = normalize(mat.eye_dir_view);
		normal_map.xy *= mat.facing;
		mat.normal_world = perturb_normal(normal_map, N, V, uv);
	#endif	
}
void resolve_normal_map(inout Material mat){
	#ifdef U_NORMAL_MAP
		process_normal_map(mat, texture2D(u_normal_map, mat.uv).rgb* 2.0 - 1.0,mat.uv);		
	#endif
}
void resolve_shading_attributes(inout Material);




#ifdef U_BARYFRAME_WIDTH
	varying vec3 v_barycentric;
	uniform float u_baryframe_width;
	uniform float u_baryframe_opacity;
	float baryframe(vec3 bary,float w) {
		vec3 d = fwidth(bary);
		vec3 f = step(d * w, bary);
		return min(min(f.x, f.y), f.z);
	}
	vec3 apply_baryframe(vec3 color){
		if(u_baryframe_width>10.9) {
			color.rgb =vec3(0.25)*mat.Fr;

float d=(1.0-abs(length(v_position_world-u_camera_position)/u_camera_bounds[1]));
			if(baryframe(v_barycentric,(0.5*d))>0.4) discard;
		}
		else {
			color.rgb =mix(color.rgb, vec3(baryframe(v_barycentric,u_baryframe_width)),u_baryframe_opacity);
		}

return color.rgb;
}
#endif

void start_main(){
	mat.uv=v_uv;
mat.frag_distance= max(0.0,min(1.0,length(v_position_world-u_camera_position)/(u_camera_bounds[1]*0.25) ));
}

void end_main(){


#ifdef U_ALPHA_MAP
	#ifdef U_ALPHA_TEST
		if(texture2D(u_alpha_map, mat.uv).r<u_alpha_test) discard;
	#else
		if(texture2D(u_alpha_map, mat.uv).r<0.4) discard;
	#endif
#endif

#ifdef U_ALPHA_TEST
	if(gl_FragColor.a<u_alpha_test) discard;
#endif



#ifdef U_SHADOW_MAP
	//gl_FragColor = gl_FragColor *calculate_shadow();
gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0),get_shadow(v_shadow_position)*0.5 );
//
#endif

}


`;
		}

		function pbr(mat) {
			mat.uniforms = Object.assign({
				u_base_color: math.vec4(1, 1, 1, 1),
				u_emissive_color: math.vec3(0, 0, 0),
				u_base_color: math.vec4(1),
				u_diffuse: math.vec3(1),
				u_specular: math.vec3(0.5),

				u_metallic: 0,
				u_normal_scale: 1,
				u_roughness: 1,
				u_glossiness: 0,
				u_reflectance: 0.5,
			}, mat.uniforms || {});

			return `
${vertex_shader()}

void vertex(){
	v_position_world+=a_instance_a_position;
	
  gl_Position = u_view_projection_matrix * vec4(v_position_world, 1.0);

	
	gl_PointSize=5.0;

	
}

${fragment_shader()}
void resolve_shading_attributes(inout Material);

void resolve_shading_attributes(inout Material mat){
	mat.ao=1.0;
	#ifdef U_ROUGHNESS_MAP
		mat.roughness =  texture2D(u_roughness_map, mat.uv).r;
	#else
		mat.roughness = u_roughness ;
	#endif

	#ifdef U_METALLIC_ROUGHNESS_MAP
			mat.roughness =  texture2D(u_matallic_roughness_map, mat.uv).g;
	#endif

	#ifdef U_AO_MAP
		mat.ao *=  texture2D(u_ao_map, mat.uv).r;
	#endif

	mat.roughness = clamp(mat.roughness, MIN_ROUGHNESS, 1.0);


	#ifdef U_METALLIC_MAP
		mat.metallic =  texture2D(u_metallic_map, mat.uv).r ;
	#else
		mat.metallic = u_metallic;
	#endif

	mat.view_world = normalize(u_camera_position - v_position_world);
	mat.NdotV = abs(dot(mat.normal_world, mat.view_world)) + FLT_EPS;
	// Compute F0 for both dielectric and metallic materials
	mat.f0 = 0.16 * u_reflectance * u_reflectance * (1.0 - mat.metallic) + mat.base_color.rgb * mat.metallic;

	mat.diffuse_color = mat.base_color.rgb * (1.0 - mat.metallic);

	mat.linear_roughness = mat.roughness* mat.roughness;

	#ifdef U_BARYFRAME_WIDTH
		mat.emissive_color=apply_baryframe(mat.emissive_color);
	#endif

}
//uniform sampler2D u_bones_texture;
uniform vec2 u_render_size;


#ifdef DEFFERED_RENDERING
	void deffered_rendering(inout Material mat);
#endif

void fragment(){
	vec3 color;
	setup_material(mat);
	resolve_base_color(mat);
	#ifdef UNLIT
		color =  mat.base_color.rgb ;
	#else
		resolve_normal_map(mat);
		resolve_shading_attributes(mat);
		apply_ambient_light(mat,	 ambient_lights[0]);
		apply_surface_shading(mat,directional_lights[0]);
		color = mat.emissive_color + mat.indirect_diffuse + mat.indirect_specular + mat.direct_color;		
	#endif
	

	gl_FragColor=vec4(color,mat.opacity);
}
`

		}


		pbr.default = function () {
			return materials.create({
				compiler: "pbr",
				props: {
					wireframe1: true,
					enable_vertex_color1: true
				},
				uniforms: {
					u_baryframe_opacity: 0.05,
					u_baryframe_width: 0.5,
				}
			});
		};

		return pbr;

	})();

	return materials;
})();