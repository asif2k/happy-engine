// happy_system export: packing.js with the in-browser wasm build taken out and a port for -serve (tools/patch_packing.js of the repo does it: node packing.js -serve [default | PORT | HOST:PORT], -port, -host, -root).
const is_browser = (typeof window !== 'undefined');

function create_packing(root_url) {
	root_url = root_url || "";
	console.log("root_url ", root_url);
	let is_browser = (typeof window !== 'undefined');
	const guidi = (function () {
		let guidCounter = 0;
		return function () {
			return (Date.now() + guidCounter++);
		}
	})();
	const each = function (callback, index) {
		const func = function (index) {
			callback(func, index);
		};
		func(index || 0);
	};
	function arguments_to_array(args) {
		let arr = [];
		args = args || [];
		for (let i = 0; i < args.length; i++) {
			arr.push(args[i]);
		}

		return arr;

	};

	const sleep = function (ms) {
		return new Promise(function (resolve) {
			setTimeout(resolve, ms);
		});
	}
	const is_function = function (obj) {
		return !!(obj && obj.constructor && obj.call && obj.apply);
	};

	const is_string = function (x) {
		return Object.prototype.toString.call(x) === "[object String]"
	};

	const is_object = function (x) {
		return Object.prototype.toString.call(x).toLocaleLowerCase() === '[object object]'
	};
	let _require = function () { return null; };

	if (typeof require != 'undefined') {
		_require = require;
	}

	const http = _require('http');
	const https = _require('https');
	const fs = _require('fs');
	const path = _require('path');

	let get_file;


	let str_to_base64, base64_to_str;

	if (is_browser) {
		const url_types = {
			undefined: "text",
			"text": "text",
			"arraybuffer": "arraybuffer",
			"blob": "blob",
			"base64": "blob"
		}

		str_to_base64 = btoa;
		base64_to_str = atob;


		get_file = function (url, type, post_data, content_type) {
	
			//console.log("get_file", [url, type]);

			return new Promise(function (resolve) {
				const xtp = new XMLHttpRequest();
				xtp.onload = function () {
					resolve(this.response);
					this.abort();
				};
				xtp.onerror = function () {
					console.log("onerror", this.response);
				};

				xtp.responseType = url_types[type];
				if (post_data) {
					xtp.open("POST", url, !0);
					if (content_type)
						xtp.setRequestHeader('Content-Type', content_type);
					else {
						xtp.setRequestHeader('Content-Type', 'application/octet-stream');
					}
					xtp.send(post_data);
				}
				else {
					xtp.open("GET", url, true);
					xtp.send();
				}


			});
		};
	}
	else {
		const fs_types = {
			undefined: "utf8",
			"text": "utf8",
			"arraybuffer": "binary",
			"blob": "binary",
			"base64": "base64"
		}
		str_to_base64 = function (v) {
			return Buffer.from(v, "ascii").toString("base64");
		};

		base64_to_str = function (v) {
			return Buffer.from(v, "base64").toString("utf8");
		};
		get_file = function (url, type) {
			return new Promise(function (resolve) {
				url = url.trim();
				//console.log("get_file", url);
				if (url.indexOf('http://') == 0) {
					http.get(url, res => {
						let data = [];
						res.on('data', chunk => {
							data.push(chunk);
						});
						res.on('end', () => {
							resolve(Buffer.concat(data).toString(fs_types[type]));
						});
					});
				}
				else if (url.indexOf('https://') == 0) {
					https.get(url, res => {
						let data = [];
						res.on('data', chunk => {
							data.push(chunk);
						});
						res.on('end', () => {
							resolve(Buffer.concat(data).toString(fs_types[type]));
						});
					});
				}
				else {
					if (url.indexOf(root_url) < 0 && !fs.existsSync(url)) url = path.join(root_url, url);
					if (fs.existsSync(url)) {
						resolve(fs.readFileSync(url, {
							encoding: fs_types[type]
						}));
					}
					else {
						console.log("url not found", url);
						resolve("Error not found", url)
					}
				}
			});
		};
	}

	const test_dep_js = /[\s\S]*?.*\.js/;

	const loaded = {}, urlsnames = {}, cache = {}, keywords = {}, loading = {}, source_compilers = [], registry = {}, globals = {}, on_bundle = [];
	let last_url = root_url;
	const compilers = {};

	loaded[true] = false;

	function empty_object(obj) {
		const dbj = {};
		Object.keys(obj).forEach(function (k) {
			dbj[k] = obj[k];
			delete obj[k];
		});
		return dbj;
	}


	function restore_object(obj, rbj) {
		Object.keys(obj).forEach(function (k) {
			delete obj[k];
		});

		Object.keys(rbj).forEach(function (k) {
			obj[k] = rbj[k];
		});
		return obj;
	}

	function entry_loaded(name) {
		if (loaded[name]) return true
	}

	function resolve_resource(name, type,base_url) {
		const entry = this;

		return new Promise(function (resolve) {
			if (cache[name] !== undefined) return resolve(cache[name]);
			if (entry.__resolvers[name]) {
				resolve(entry.__resolvers[name]());
				return;
			}
			last_url = name;
			get_file(name, type).then(function (data) {
				if (type == "base64" && is_browser) {
					let reader = new FileReader();
					reader.readAsDataURL(data);
					reader.onloadend = function () {
						data = reader.result.split(",")[1];
						cache[name] = data;
						resolve(data);
					}
				}
				else {
					cache[name] = data;
					resolve(data);
				}

			})

		})
	}

	function resolve_path(url) {
		if (this.__resolvers[url]) return url;

		if (!is_browser) {
			console.log("resolve_path", url);

			if (fs.existsSync(url)) {
				return url;
			}
		}

		if ((url.indexOf("/") !== 0
			&& url.indexOf("@") !== 0
			&& (!(/http.*\:\/\//).test(url))

		)) url = this.__base_folder + url;
		url = url.replace("@", root_url);


		return url;
	}
	let packing;


	function get_export_packages(entry, list) {


		list = list || [];
		if (entry === undefined || entry.__is_child) return list;
		entry.__packages.forEach(function (b) {
			get_export_packages(loaded[b], list);
			list.push(b);
			if (loaded[b]) {
				loaded[b].__children.forEach(function (c) {
					if (loaded[c]) {
						loaded[c].__packages.forEach(function (cp) {
							list.push(cp);
						})
					}
					list.push(c);
				});
			}

		});

		return list;
	}

	function export_entry(entry) {
		return new Promise(function (resolve) {
			const list = get_export_packages(entry);
			list.push(entry.__name);
			//console.log(entry.__name, list.slice());
			const output = [];
			//	output.push('(function(document){')
			output.push('function BB(document){')
			output.push("const is_browser = (typeof window !== 'undefined');const global=function(f){return f}\n");
			if (!is_browser) {
				output.push(
					'if (typeof atob == "undefined") {atob=function(v){return Buffer.from(v, "utf8").toString("base64");}}',
					'if (typeof btoa == "undefined") {btoa=function(v){return Buffer.from(v, "base64").toString("utf8");}}'
				);
			}
			if (entry.__include_packing) {
				const packing_source = str_to_base64(create_packing.toString());
				output.push('\nconst create_packing=new Function("return "+atob("' + packing_source + '"))();',
					'let packing;',
					'if (is_browser) packing = create_packing(""); else packing = create_packing(process.cwd());');
			}
			output.push('const __BB={};');

			output.push('if(typeof preloader !== "undefined") preloader(__BB);');
			const exportednow = {};



			Object.keys(entry.__store).forEach(function (k) {
				output.push('__BB["' + k + '"]=atob("' + str_to_base64(entry.__store[k]) + '");\n');
			});

			list.forEach(function (L) {
				if (exportednow[L]) return;
				if (loaded[L]) {

					const lntry = loaded[L];

					//console.log(L, lntry.__compressed);
					if (lntry.__compressed == true || entry.__compressed) {
						output.push('__BB["' + L + '"]=new Function("return "+atob("' + str_to_base64(lntry.__source) + '"))()');
					}
					else {
						output.push('__BB["' + L + '"]=' + lntry.__source);
					}



					//console.log(lntry.__name, lntry.__args)

					lntry.__args.forEach(function (a) {
						if (lntry.__resources[a]) {
							output.push('__BB["' + a + '"]=packing.loaded["' + L + '"].__resources["' + a + '"];');
						}
					});

					output.push('__BB["' + L + '"]=__BB["' + L + '"]' + '.apply(__BB["' + L + '"],[' + lntry.__args.map(
						function (a) {
							if (a.indexOf("=") > 0) {
								a = a.split("=");
								a = JSON.parse(a[1].trim());
							}
							if (lntry.__resources[a]) {
								//return 'bunn.loaded["' + L + '"].__resources["' + a + '"]';
							}

							else if (entry.__resources[a]) {
								//   return 'packing.loaded["' + entry.__name + '"].__resources["' + a + '"]';
							}
							else if (entry.__store[a]) {
								return '__BB["' + a + '"]';
							}
							else if (globals[a]) {
								return '__BB["' + globals[a] + '"]["' + a + '"]';
							}
							else if (a === "entry") {
								return entry.__name;
							}
							return '__BB["' + a + '"]'

						}).join() + ']);');
				}
				exportednow[L] = true;

			});
			output.push('return __BB;}');

			let bundle = output.join("\n");

			function final_bundle(bundle) {
				return [
					'(',
					bundle,
					')((',
					function () {
						let doc = {};

						if (typeof document !== "undefined") {
							doc = document;
						}
						if (typeof helement !== "undefined") {
							doc.helement = helement;
						}
						return doc;
					}.toString(),
					')())'

				].join('').replace(/__BB/g, entry.__name.length > 0 ? entry.__name : "entry");


			}
			each(function (next, i) {
				if (i <= on_bundle.length - 1) {
					const BB = on_bundle[i];
					const res = BB(bundle, entry);
					if (res instanceof Promise) {
						res.then(function (res) {
							bundle = res;
							next(i + 1);
						});
					}
					else {
						bundle = res;
						next(i + 1);

					}
				}
				else {
					bundle = final_bundle(bundle);
					resolve(bundle);
				}

			}, 0);



		});
	}
	function hash_str(str) {
		let hash = 2166136261;
		for (let i = 0; i < str.length; i++) {
			hash ^= str.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return hash >>> 0;
	}

	const compile_entry = (function () {

		function parse_include(text, entry, base_url, done, _tag) {
		
			let res = [], s, ic, h, url, t, aa, force;
			base_url = base_url.replace(/\/\//g,'/');

			let text2 = " " + text;
			_tag = _tag || "import";

			const _rgx = new RegExp(_tag + "\\(.*\\)", "g");

			ic = text2.search(_rgx);
			while (ic > 0) {
				s = text2.substr(ic, (text2.indexOf(")", ic) - ic) + 1);
				if (!(s == _tag + "()")) {
					res.push(s);
				//	console.log("parse_include", [s, base_url, _tag]);

				}
			
				text2 = text2.replace(s, "");
				ic = text2.search(_rgx);
			}



			if (res.length > 0) {
				each(function (next, i) {
					if (i > res.length - 1) {
						done(text);
						return;
					}

					t = undefined;
					s = res[i];


					url = s.substr(s.indexOf("(") + 1, (s.indexOf(")") - s.indexOf("(")) - 1).replace(/\'|\"/g, '').trim();

					//  console.log("url", url);
					if (url.indexOf(",") > 0) {
						aa = url.split(",");
						t = aa[1].trim();
						url = aa[0].trim();
					}


					// if (url.indexOf("/") !== 0 && url.indexOf("@") !== 0 && (!(/http.*\:\/\//).test(url))) url = base_url + url;
					url = entry.__resolve_path(/^(@|\/|[a-z][a-z0-9+.-]*:\/\/)/i.test(url) ? url : base_url + url);   // "@/x", "/x" and "http://x" mean the same in every file: the folder of the file that holds them is not put in front
			//	console.log("__resolve_path", s, url);

					entry.__resolve(url, t).then(function (data) {
						
						ic = text.indexOf(s);
						//console.log('__resolve', [ic, s, url, data.length, text.length]);
						parse_include(data, entry, url.replace(/[^\/]*$/, ""), function (data) {   // what that file includes without "@/" is read from its own folder
							text = text.substr(0, ic) + (data) + text.substr(ic + s.length, text.length);
							next(i + 1);
						}, _tag);
					});
				});
			}
			else {
				//console.log(_tag, "done", text.length);
				done(text);
			}


		}

		const script_gen = (function () {

			// --- PRECEDENCE TABLE ---
			var PRECEDENCE = {
				'=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '%=': 1,
				'**=': 1,
				'<<=': 1, '>>=': 1, '>>>=': 1, '&=': 1, '^=': 1, '|=': 1,
				'||=': 1, '&&=': 1, '??=': 1,
				'?': 2, // Conditional
				'??': 2, // Nullish coalescing (same level as ternary for parsing)
				'||': 3,
				'&&': 4,
				'|': 5,
				'^': 6,
				'&': 7,
				'==': 8, '!=': 8, '===': 8, '!==': 8,
				'<': 9, '>': 9, '<=': 9, '>=': 9, 'in': 9, 'instanceof': 9,
				'<<': 10, '>>': 10, '>>>': 10,
				'+': 11, '-': 11,
				'*': 12, '/': 12, '%': 12,
				'**': 13,
				'prefix': 14,
				'postfix': 15,
				'call': 17,
				'member': 18
			};

			// Explicit list of right-associative assignment operators
			var ASSIGNMENT_OPS = [
				'=', '+=', '-=', '*=', '**=', '/=', '%=',
				'<<=', '>>=', '>>>=', '&=', '^=', '|=',
				'||=', '&&=', '??='
			];

			// --- LEXER PATTERNS ---
			// FIX: Added ** and **= operators (must come before single * to match greedily).
			//      Added ?? and ??= and ||= and &&= operators.
			//      Added ... (spread/rest) as a Punctuation token.
			var PATTERNS = [
				{ type: 'Whitespace', regex: /^\s+/ },
				{ type: 'Comment', regex: /^(\/\/.*|\/\*[\s\S]*?\*\/)/ },
				// Numbers: hex (0x...), binary (0b...), octal (0o...), float, int
				{ type: 'Number', regex: /^(0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|\d+(\.\d+)?([eE][+-]?\d+)?)/ },
				// Strings: double-quoted, single-quoted, template literal (backtick)
				{ type: 'String', regex: /^"((?:[^"\\]|\\[\s\S])*)"|^'((?:[^'\\]|\\[\s\S])*)'|^`((?:[^`\\]|\\[\s\S])*)`/ },
				// Keywords
				{ type: 'Keyword', regex: /^(break|case|catch|const|continue|debugger|default|delete|do|else|finally|for|function|if|in|instanceof|let|new|return|switch|this|throw|try|typeof|var|void|while|with)\b/ },
				{ type: 'Identifier', regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*/ },
				// Operators: longer tokens MUST come before their prefixes.
				// **= before **, >>= before >>, etc.
				{ type: 'Operator', regex: /^(\*\*=|\*\*|\+\+|--|===|!==|==|!=|<=|>=|=>|&&=|\|\|=|\?\?=|&&|\|\||\?\?|>>>=|<<=|>>=|\+=|-=|\*=|\/=|%=|\|=|&=|\^=|>>>|<<|>>|[+\-*/%=<>!&|^~])/ },
				// Punctuation: multi-char tokens MUST come before the single-char character class.
				// '...' before '.', '?.' before '?' and '.'
				{ type: 'Punctuation', regex: /^(\.\.\.|\.\.|\?\.|[{}[\](),;.:?])/ }
			];


			// --- LEXER ---

			function lexer(input) {
				var cursor = 0;
				var tokens = [];
				var line = 1;
				var column = 0;

				// Context tracking: can the next '/' be a regex literal?
				var canBeRegex = true;

				while (cursor < input.length) {
					var remaining = input.slice(cursor);
					var matchFound = false;

					// 1. Check for Regex Literal (only when '/' is not division)
					if (canBeRegex && remaining.charAt(0) === '/') {
						var regexMatch = /^\/((?:\\.|[^/\\\n])+)\/([gimsuy]*)/.exec(remaining);
						if (regexMatch) {
							tokens.push({
								type: 'RegExp',
								value: regexMatch[0],
								line: line,
								column: column
							});
							cursor += regexMatch[0].length;
							column += regexMatch[0].length;
							canBeRegex = false;
							continue;
						}
					}

					// 2. Standard Patterns
					for (var i = 0; i < PATTERNS.length; i++) {
						var match = PATTERNS[i].regex.exec(remaining);
						if (match) {
							var text = match[0];

							if (PATTERNS[i].type !== 'Whitespace' && PATTERNS[i].type !== 'Comment') {
								tokens.push({
									type: PATTERNS[i].type,
									value: text,
									line: line,
									column: column
								});

								// Update canBeRegex context for next token
								var t = PATTERNS[i].type;
								if (t === 'Identifier' || t === 'Number') {
									canBeRegex = false;
								} else if (t === 'Punctuation') {
									// After ) or ] a '/' is division; after everything else it could be regex
									canBeRegex = (text !== ')' && text !== ']');
								} else if (t === 'Operator') {
									canBeRegex = true;
								} else if (t === 'Keyword') {
									canBeRegex = (text !== 'this');
								} else if (t === 'String' || t === 'RegExp') {
									canBeRegex = false;
								}
							}

							// Update line/column tracking
							var newlines = text.split('\n');
							if (newlines.length > 1) {
								line += newlines.length - 1;
								column = newlines[newlines.length - 1].length;
							} else {
								column += text.length;
							}

							cursor += text.length;
							matchFound = true;
							break;
						}
					}

					if (!matchFound) {
						console.warn("Unknown character at " + line + ":" + column + " -> " + remaining[0]);
						cursor++;
						column++;
					}
				}

				tokens.forEach(function (tok, i) { tok.index = i; });
				return tokens;
			}

			// --- PARSER CONSTRUCTOR ---
			function script_gen(code) {
				this.tokens = lexer(code);
				this.cursor = 0;
				this.prevToken = null;
			}

			script_gen.prototype.newProgram = function (code) {
				this.tokens = lexer(code);
				this.cursor = 0;
				this.prevToken = null;
				return this;
			};

			(function () {

				script_gen.prototype.eof = function () {
					return this.cursor >= this.tokens.length;
				};

				script_gen.prototype.peek = function () {
					return this.tokens[this.cursor] || { type: 'EOF', value: '' };
				};

				script_gen.prototype.peekAt = function (offset) {
					return this.tokens[this.cursor + offset] || { type: 'EOF', value: '' };
				};

				// --- EAT with Automatic Semicolon Insertion ---
				script_gen.prototype.eat = function (type) {
					var token = this.peek();

					if (type === ';') {
						if (token.value === ';') {
							this.prevToken = token;
							this.cursor++;
							return token;
						}
						// ASI: EOF, '}', or a line break between prev and current token
						var isLineBreak = this.prevToken && token.type !== 'EOF' && (token.line > this.prevToken.line);
						var isBlockEnd = token.value === '}';
						var isEOF = token.type === 'EOF';
						if (isLineBreak || isBlockEnd || isEOF) {
							return { type: 'Punctuation', value: ';', generated: true };
						}
						// FIX: removed the stray bare `return token;` that short-circuited ASI logic
					}

					if (!token || (type && token.type !== type && token.value !== type)) {
						var err = new Error('Unexpected token: ' + (token ? token.value : 'EOF') +
							' (expected ' + type + ') at ' + (token ? token.line + ':' + token.column : 'EOF'));
						if (token) err.loc = { line: token.line, column: token.column };
						console.log(token, this);
						throw err;
					}
					this.prevToken = token;
					this.cursor++;
					return token;
				};

				// --- PROGRAM ---

				script_gen.prototype.parseProgram = function () {
					var body = [];
					while (!this.eof()) {
						body.push(this.parseStatement());
					}
					return { type: 'Program', body: body };
				};

				// --- STATEMENTS ---

				script_gen.prototype.parseStatement = function () {
					var token = this.peek();

					// Empty statement
					if (token.value === ';') {
						this.eat(';');
						return { type: 'EmptyStatement' };
					}

					// Declarations
					if (token.value === 'function') return this.parseFunctionDeclaration();
					if (token.value === 'var' || token.value === 'let' || token.value === 'const') return this.parseVariableDeclaration();

					// Control flow
					if (token.value === 'return') return this.parseReturnStatement();
					if (token.value === 'if') return this.parseIfStatement();
					if (token.value === 'for') return this.parseForStatement();
					if (token.value === 'while') return this.parseWhileStatement();
					if (token.value === 'do') return this.parseDoWhileStatement();
					if (token.value === 'switch') return this.parseSwitchStatement();
					if (token.value === 'try') return this.parseTryCatch();
					if (token.value === 'throw') return this.parseThrowStatement();
					if (token.value === 'break') { this.eat('break'); this.eat(';'); return { type: 'BreakStatement' }; }
					if (token.value === 'continue') { this.eat('continue'); this.eat(';'); return { type: 'ContinueStatement' }; }
					if (token.value === 'debugger') { this.eat('debugger'); this.eat(';'); return { type: 'DebuggerStatement' }; }

					// Block
					if (token.value === '{') return this.parseBlock();

					// Labeled statement: Identifier followed immediately by ':'
					if (token.type === 'Identifier') {
						var next = this.tokens[this.cursor + 1];
						if (next && next.value === ':') {
							var label = this.eat('Identifier');
							this.eat(':');
							var body = this.parseStatement();
							return { type: 'LabeledStatement', label: label, body: body };
						}
					}

					// Expression statement � parseExpression handles SequenceExpressions (comma operator)
					var expr = this.parseExpression();
					this.eat(';');
					return { type: 'ExpressionStatement', expression: expr };
				};

				script_gen.prototype.parseBlock = function () {
					this.eat('{');
					var body = [];
					while (!this.eof() && this.peek().value !== '}') {
						body.push(this.parseStatement());
					}
					this.eat('}');
					return { type: 'BlockStatement', body: body };
				};

				script_gen.prototype.parseVariableDeclaration = function () {
					var kind = this.eat().value; // var, let, const
					var declarations = [];
					do {
						// FIX: support destructuring patterns as declarator id
						var id = this.parseBindingPattern();
						var init = null;
						if (this.peek().value === '=') {
							this.eat('=');
							// FIX: use parseAssignmentExpression so commas don't bleed into sequence
							init = this.parseAssignmentExpression();
						}
						declarations.push({
							type: 'VariableDeclarator',
							id: id,
							init: init
						});
					} while (this.peek().value === ',' && this.eat(','));
					this.eat(';');
					return { type: 'VariableDeclaration', declarations: declarations, kind: kind };
				};

				// Like parseVariableDeclaration but without the trailing semicolon (used in for-init)
				script_gen.prototype.parseVariableDeclarationList = function () {
					var kind = this.eat().value;
					var declarations = [];
					do {
						var id = this.parseBindingPattern();
						var init = null;
						if (this.peek().value === '=') {
							this.eat('=');
							init = this.parseAssignmentExpression();
						}
						declarations.push({
							type: 'VariableDeclarator',
							id: id,
							init: init
						});
					} while (this.peek().value === ',' && this.eat(','));
					return { type: 'VariableDeclaration', declarations: declarations, kind: kind };
				};

				// FIX: Parse destructuring binding patterns ({ a, b } or [ a, b ])
				// Falls back to plain Identifier for the common case.
				script_gen.prototype.parseBindingPattern = function () {
					var token = this.peek();
					if (token.value === '{') {
						return this.parseObjectPattern();
					}
					if (token.value === '[') {
						return this.parseArrayPattern();
					}
					return { type: 'Identifier', name: this.eat('Identifier').value };
				};

				script_gen.prototype.parseObjectPattern = function () {
					this.eat('{');
					var props = [];
					while (this.peek().value !== '}') {
						if (this.peek().value === '...') {
							this.eat('...');
							props.push({
								type: 'RestElement',
								argument: { type: 'Identifier', name: this.eat('Identifier').value }
							});
							break;
						}
						var key;
						var computed = false;
						if (this.peek().value === '[') {
							this.eat('[');
							key = this.parseAssignmentExpression();
							this.eat(']');
							computed = true;
						} else if (this.peek().type === 'Identifier' || this.peek().type === 'Keyword') {
							key = { type: 'Identifier', name: this.eat().value };
						} else {
							key = { type: 'Literal', value: this.peek().value, raw: this.eat().value };
						}

						var value;
						if (this.peek().value === ':') {
							this.eat(':');
							value = this.parseBindingPattern();
						} else {
							// Shorthand: { a } or { a = default }
							value = { type: 'Identifier', name: key.name };
						}

						var defaultValue = null;
						if (this.peek().value === '=') {
							this.eat('=');
							defaultValue = this.parseAssignmentExpression();
						}

						props.push({
							type: 'Property',
							key: key,
							value: defaultValue ? { type: 'AssignmentPattern', left: value, right: defaultValue } : value,
							computed: computed,
							shorthand: !computed && value.type === 'Identifier' && (!key.name || key.name === value.name)
						});
						if (this.peek().value === ',') this.eat(','); else break;
					}
					this.eat('}');
					return { type: 'ObjectPattern', properties: props };
				};

				script_gen.prototype.parseArrayPattern = function () {
					this.eat('[');
					var elements = [];
					while (this.peek().value !== ']') {
						if (this.peek().value === ',') {
							elements.push(null); // hole
							this.eat(',');
							continue;
						}
						if (this.peek().value === '...') {
							this.eat('...');
							elements.push({ type: 'RestElement', argument: this.parseBindingPattern() });
							break;
						}
						var el = this.parseBindingPattern();
						if (this.peek().value === '=') {
							this.eat('=');
							el = { type: 'AssignmentPattern', left: el, right: this.parseAssignmentExpression() };
						}
						elements.push(el);
						if (this.peek().value === ',') this.eat(','); else break;
					}
					this.eat(']');
					return { type: 'ArrayPattern', elements: elements };
				};

				script_gen.prototype.parseFunctionDeclaration = function () {
					this.eat('function');
					var generator = false;
					if (this.peek().value === '*') { this.eat('*'); generator = true; }
					var id = { type: 'Identifier', name: 'anonymous' };
					if (this.peek().type === 'Identifier') {
						id = { type: 'Identifier', name: this.eat('Identifier').value };
					}
					this.eat('(');
					var params = this.parseParamList();
					this.eat(')');
					var body = this.parseBlock();
					return { type: 'FunctionDeclaration', id: id, params: params, body: body, generator: generator };
				};

				script_gen.prototype.parseIfStatement = function () {
					this.eat('if');
					this.eat('(');
					var test = this.parseExpression();
					this.eat(')');
					var consequent = this.parseStatement();
					var alternate = null;
					if (this.peek().value === 'else') {
						this.eat('else');
						alternate = this.parseStatement();
					}
					return { type: 'IfStatement', test: test, consequent: consequent, alternate: alternate };
				};

				script_gen.prototype.parseReturnStatement = function () {
					this.eat('return');
					var argument = null;
					var isLineBreak = this.prevToken && this.peek().type !== 'EOF' && (this.peek().line > this.prevToken.line);
					if (this.peek().value !== ';' && !isLineBreak && this.peek().value !== '}') {
						argument = this.parseExpression();
					}
					this.eat(';');
					return { type: 'ReturnStatement', argument: argument };
				};

				script_gen.prototype.parseForStatement = function () {
					this.eat('for');
					this.eat('(');

					var init = null;

					if (this.peek().value === 'var' || this.peek().value === 'let' || this.peek().value === 'const') {
						init = this.parseVariableDeclarationList();
					} else if (this.peek().value !== ';') {
						init = this.parseExpression();
					}

					// Check for for-in / for-of
					var isForIn = false, isForOf = false;
					var right = null;

					if (this.peek().value === 'in') {
						this.eat('in');
						isForIn = true;
						right = this.parseExpression();
					} else if (this.peek().type === 'Identifier' && this.peek().value === 'of') {
						this.eat();
						isForOf = true;
						right = this.parseExpression();
					} else if (init && init.type === 'BinaryExpression' && init.operator === 'in') {
						// 'in' was consumed as binary op � re-interpret as for-in
						isForIn = true;
						right = init.right;
						init = init.left;
					}

					if (isForIn) {
						this.eat(')');
						var body = this.parseStatement();
						return { type: 'ForInStatement', left: init, right: right, body: body };
					}
					if (isForOf) {
						this.eat(')');
						var body = this.parseStatement();
						return { type: 'ForOfStatement', left: init, right: right, body: body };
					}

					// Standard for loop
					this.eat(';');
					var test = null;
					if (this.peek().value !== ';') test = this.parseExpression();
					this.eat(';');
					var update = null;
					if (this.peek().value !== ')') update = this.parseExpression();
					this.eat(')');
					var body = this.parseStatement();
					return { type: 'ForStatement', init: init, test: test, update: update, body: body };
				};

				script_gen.prototype.parseWhileStatement = function () {
					this.eat('while');
					this.eat('(');
					var test = this.parseExpression();
					this.eat(')');
					var body = this.parseStatement();
					return { type: 'WhileStatement', test: test, body: body };
				};

				script_gen.prototype.parseDoWhileStatement = function () {
					this.eat('do');
					var body = this.parseStatement();
					this.eat('while');
					this.eat('(');
					var test = this.parseExpression();
					this.eat(')');
					this.eat(';');
					return { type: 'DoWhileStatement', body: body, test: test };
				};

				script_gen.prototype.parseSwitchStatement = function () {
					this.eat('switch');
					this.eat('(');
					var disc = this.parseExpression();
					this.eat(')');
					this.eat('{');
					var cases = [];
					while (this.peek().value !== '}') {
						var test = null;
						if (this.peek().value === 'case') { this.eat('case'); test = this.parseExpression(); }
						else { this.eat('default'); }
						this.eat(':');
						var cons = [];
						while (this.peek().value !== 'case' && this.peek().value !== 'default' && this.peek().value !== '}') {
							cons.push(this.parseStatement());
						}
						cases.push({ type: 'SwitchCase', test: test, consequent: cons });
					}
					this.eat('}');
					return { type: 'SwitchStatement', discriminant: disc, cases: cases };
				};

				script_gen.prototype.parseThrowStatement = function () {
					this.eat('throw');
					var arg = this.parseExpression();
					this.eat(';');
					return { type: 'ThrowStatement', argument: arg };
				};

				script_gen.prototype.parseTryCatch = function () {
					this.eat('try');
					var block = this.parseBlock();
					var handler = null;
					var finalizer = null;
					if (this.peek().value === 'catch') {
						this.eat('catch');
						var param = null;
						if (this.peek().value === '(') {
							this.eat('(');
							param = { type: 'Identifier', name: this.eat('Identifier').value };
							this.eat(')');
						}
						var body = this.parseBlock();
						handler = { type: 'CatchClause', param: param, body: body };
					}
					if (this.peek().value === 'finally') {
						this.eat('finally');
						finalizer = this.parseBlock();
					}
					return { type: 'TryStatement', block: block, handler: handler, finalizer: finalizer };
				};

				// --- EXPRESSIONS ---

				// parseExpression: top-level � handles the comma/sequence operator.
				// Use this for: statement-level, return, throw, if/while/for conditions,
				// for-update, switch discriminant.
				script_gen.prototype.parseExpression = function () {
					var expr = this.parseAssignmentExpression();
					// FIX: SequenceExpression support � comma operator at statement level
					if (this.peek().value === ',') {
						var exprs = [expr];
						while (this.peek().value === ',') {
							this.eat(',');
							exprs.push(this.parseAssignmentExpression());
						}
						return { type: 'SequenceExpression', expressions: exprs };
					}
					return expr;
				};

				// parseAssignmentExpression: single expression without sequence comma.
				// Use this for: array elements, object values, call arguments,
				// variable declarator inits, default parameter values � anywhere a comma
				// is a separator rather than an operator.
				script_gen.prototype.parseAssignmentExpression = function () {
					// Arrow function with no params: () => ...
					// Detected early: peek is '(' and the closing ')' is followed by '=>'
					// We handle this by letting parseAtom produce a GroupExpression then catching '=>' below.

					var expr = this.parseBinaryExpression(this.parseMaybeUnary(), 0);

					// Ternary / conditional
					if (this.peek().value === '?') {
						this.eat('?');
						var consequent = this.parseAssignmentExpression();
						this.eat(':');
						var alternate = this.parseAssignmentExpression();
						return { type: 'ConditionalExpression', test: expr, consequent: consequent, alternate: alternate };
					}

					// Arrow function: params => body
					if (this.peek().value === '=>') {
						this.eat('=>');
						var params = this.arrowParamsFromExpr(expr);
						var body;
						if (this.peek().value === '{') {
							body = this.parseBlock();
						} else {
							body = this.parseAssignmentExpression();
						}
						return { type: 'ArrowFunctionExpression', params: params, body: body, expression: body.type !== 'BlockStatement' };
					}

					return expr;
				};

				// Convert a parsed expression into an arrow-function parameter list.
				script_gen.prototype.arrowParamsFromExpr = function (expr) {
					// Single bare identifier: x =>
					if (expr.type === 'Identifier') {
						return [expr];
					}
					// Grouped expression: (a, b) => or () => or (a) =>
					if (expr.type === 'GroupExpression') {
						// Empty params: () =>
						if (!expr.argument) return [];
						var inner = expr.argument;
						// Single identifier param: (a) =>
						if (inner.type === 'Identifier') return [inner];
						// Destructuring or rest: ([a,b]) => or ({a}) => or (...rest) =>
						if (inner.type === 'ObjectPattern' || inner.type === 'ArrayPattern' || inner.type === 'RestElement') return [inner];
						// Default: (a = 1) => � was parsed as BinaryExpression with op '='
						if (inner.type === 'BinaryExpression' && inner.operator === '=') {
							return [{ type: 'AssignmentPattern', left: inner.left, right: inner.right }];
						}
						// Multiple params via SequenceExpression: (a, b, c) =>
						if (inner.type === 'SequenceExpression') {
							return inner.expressions.map(function (e) {
								if (e.type === 'BinaryExpression' && e.operator === '=') {
									return { type: 'AssignmentPattern', left: e.left, right: e.right };
								}
								if (e.type === 'SpreadElement') {
									return { type: 'RestElement', argument: e.argument };
								}
								return e;
							});
						}
						return [inner];
					}
					// SpreadElement at top level: ...rest =>  (rare but valid)
					if (expr.type === 'SpreadElement') {
						return [{ type: 'RestElement', argument: expr.argument }];
					}
					return [];
				};

				script_gen.prototype.parseBinaryExpression = function (left, minPrecedence) {
					var token = this.peek();
					while (
						token &&
						token.value !== '=>' &&  // => is not a binary operator
						(token.type === 'Operator' || token.value === 'in' || token.value === 'instanceof') &&
						(PRECEDENCE[token.value] !== undefined ? PRECEDENCE[token.value] : -1) >= minPrecedence
					) {
						var op = token.value;
						var prec = PRECEDENCE[op] || 0;
						var nextMin = (ASSIGNMENT_OPS.indexOf(op) !== -1) ? prec : prec + 1;

						this.eat(); // consume the operator

						var right;
						if (ASSIGNMENT_OPS.indexOf(op) !== -1) {
							right = this.parseAssignmentExpression();
						} else {
							right = this.parseBinaryExpression(this.parseMaybeUnary(), nextMin);
						}

						left = { type: 'BinaryExpression', operator: op, left: left, right: right };
						token = this.peek();
					}
					return left;
				};

				script_gen.prototype.parseMaybeUnary = function () {
					var token = this.peek();

					// FIX: added '~' (bitwise NOT) and 'void' to prefix operators
					if (['++', '--', '!', '+', '-', '~', 'typeof', 'void', 'delete', 'await'].indexOf(token.value) !== -1) {
						this.eat();
						var arg = this.parseMaybeUnary();
						var nodeType = (token.value === '++' || token.value === '--') ? 'UpdateExpression' : 'UnaryExpression';
						return { type: nodeType, operator: token.value, prefix: true, argument: arg };
					}

					// FIX: spread/rest inside expressions: ...x
					if (token.value === '...') {
						this.eat('...');
						var arg = this.parseMaybeUnary();
						return { type: 'SpreadElement', argument: arg };
					}

					var expr = this.parseMemberExpression();

					// Postfix ++ / --  (no newline between expr and operator)
					if (this.peek().value === '++' || this.peek().value === '--') {
						if (!(this.prevToken && this.peek().line > this.prevToken.line)) {
							var op = this.eat().value;
							return { type: 'UpdateExpression', operator: op, prefix: false, argument: expr };
						}
					}
					return expr;
				};

				script_gen.prototype.parseMemberExpression = function (allowCall) {
					allowCall = allowCall !== false;
					var object = this.parseAtom();

					while (true) {
						if (this.peek().value === '.') {
							this.eat('.');
							var propToken = this.peek();
							var prop;
							if (propToken.type === 'Keyword') {
								prop = { type: 'Identifier', name: this.eat().value };
							} else if (propToken.type === 'String') {
								var raw = this.eat().value;
								prop = { type: 'Identifier', name: raw.slice(1, -1) };
							} else {
								var eaten = this.eat('Identifier');
								prop = { type: 'Identifier', name: eaten.value };
							}
							object = { type: 'MemberExpression', object: object, property: prop, computed: false };

						} else if (this.peek().value === '[') {
							this.eat('[');
							var prop = this.parseExpression();
							this.eat(']');
							object = { type: 'MemberExpression', object: object, property: prop, computed: true };

						} else if (allowCall && this.peek().value === '(') {
							this.eat('(');
							var args = this.parseArgumentList();
							this.eat(')');
							object = { type: 'CallExpression', callee: object, arguments: args };

						} else if (this.peek().value === '?.') {
							// Optional chaining: obj?.prop or obj?.[expr] or obj?.()
							this.eat('?.');
							if (this.peek().value === '[') {
								this.eat('[');
								var prop = this.parseExpression();
								this.eat(']');
								object = { type: 'OptionalMemberExpression', object: object, property: prop, computed: true, optional: true };
							} else if (this.peek().value === '(') {
								this.eat('(');
								var args = this.parseArgumentList();
								this.eat(')');
								object = { type: 'OptionalCallExpression', callee: object, arguments: args, optional: true };
							} else {
								var eaten = this.eat('Identifier');
								object = { type: 'OptionalMemberExpression', object: object, property: { type: 'Identifier', name: eaten.value }, computed: false, optional: true };
							}
						} else {
							break;
						}
					}
					return object;
				};

				// FIX: Centralised argument-list parser used by calls AND new-expressions.
				// Uses parseAssignmentExpression so commas separate args, not build sequences.
				// Handles spread elements (...x) as arguments.
				script_gen.prototype.parseArgumentList = function () {
					var args = [];
					while (this.peek().value !== ')') {
						if (this.peek().value === '...') {
							this.eat('...');
							args.push({ type: 'SpreadElement', argument: this.parseAssignmentExpression() });
						} else {
							args.push(this.parseAssignmentExpression());
						}
						if (this.peek().value === ',') {
							this.eat(',');
							// Allow trailing comma: func(a, b,)
						} else {
							break;
						}
					}
					return args;
				};

				// FIX: Centralised parameter-list parser (handles defaults, rest, destructuring).
				script_gen.prototype.parseParamList = function () {
					var params = [];
					while (this.peek().value !== ')') {
						if (this.peek().value === '...') {
							this.eat('...');
							params.push({ type: 'RestElement', argument: this.parseBindingPattern() });
							break; // rest must be last
						}
						var param = this.parseBindingPattern();
						if (this.peek().value === '=') {
							this.eat('=');
							param = { type: 'AssignmentPattern', left: param, right: this.parseAssignmentExpression() };
						}
						params.push(param);
						if (this.peek().value === ',') this.eat(','); else break;
					}
					return params;
				};

				script_gen.prototype.parseAtom = function () {
					var token = this.peek();

					// Number
					if (token.type === 'Number') {
						this.eat();
						return { type: 'Literal', value: Number(token.value), raw: token.value };
					}

					// Template literal � transpile to string concatenation
					if (token.type === 'String' && token.value.charAt(0) === '`') {
						this.eat();
						var raw = token.value.slice(1, -1);
						var parts = [];
						var buffer = '';
						var depth = 0;
						var inExpr = false;

						for (var i = 0; i < raw.length; i++) {
							var ch = raw[i];
							if (inExpr) {
								if (ch === '{') depth++;
								else if (ch === '}') depth--;
								if (depth === 0) {
									var subParser = new script_gen(buffer);
									parts.push(subParser.parseExpression());
									inExpr = false;
									buffer = '';
								} else {
									buffer += ch;
								}
							} else {
								if (ch === '$' && raw[i + 1] === '{') {
									if (buffer.length > 0) {
										var esc = buffer.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
										parts.push({ type: 'Literal', value: buffer, raw: '"' + esc + '"' });
									}
									buffer = '';
									inExpr = true;
									i++; depth = 1;
								} else {
									buffer += ch;
								}
							}
						}
						if (buffer.length > 0) {
							var esc = buffer.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
							parts.push({ type: 'Literal', value: buffer, raw: '"' + esc + '"' });
						}
						if (parts.length === 0) return { type: 'Literal', value: '', raw: '""' };
						if (parts[0].type !== 'Literal') parts.unshift({ type: 'Literal', value: '', raw: '""' });
						var root = parts[0];
						for (var j = 1; j < parts.length; j++) {
							root = { type: 'BinaryExpression', operator: '+', left: root, right: parts[j] };
						}
						return root;
					}

					// Regular string
					if (token.type === 'String') {
						this.eat();
						return { type: 'Literal', value: token.value, raw: token.value };
					}

					// RegExp
					if (token.type === 'RegExp') {
						this.eat();
						return { type: 'Literal', value: token.value, raw: token.value, regex: true };
					}

					// Keywords
					if (token.type === 'Keyword') {
						if (token.value === 'function') return this.parseFunctionExpression();
						if (token.value === 'this') { this.eat(); return { type: 'ThisExpression' }; }
						if (token.value === 'new') {
							this.eat();
							// FIX: handle `new.target`
							if (this.peek().value === '.' && this.peekAt(1).value === 'target') {
								this.eat('.'); this.eat('target');
								return { type: 'MetaProperty', meta: { type: 'Identifier', name: 'new' }, property: { type: 'Identifier', name: 'target' } };
							}
							var callee = this.parseMemberExpression(false);
							var args = [];
							if (this.peek().value === '(') {
								this.eat('(');
								args = this.parseArgumentList();
								this.eat(')');
							}
							return { type: 'NewExpression', callee: callee, arguments: args };
						}
						// FIX: `typeof`, `void`, `delete` should have been caught in parseMaybeUnary,
						// but guard here so they don't become unknown atoms.
						if (token.value === 'typeof' || token.value === 'void' || token.value === 'delete') {
							this.eat();
							var arg = this.parseMaybeUnary();
							return { type: 'UnaryExpression', operator: token.value, prefix: true, argument: arg };
						}
					}

					// Identifiers (includes true, false, null, undefined)
					if (token.type === 'Identifier') {
						if (token.value === 'true') { this.eat(); return { type: 'Literal', value: true, raw: 'true' }; }
						if (token.value === 'false') { this.eat(); return { type: 'Literal', value: false, raw: 'false' }; }
						if (token.value === 'null') { this.eat(); return { type: 'Literal', value: null, raw: 'null' }; }
						if (token.value === 'undefined') { this.eat(); return { type: 'Literal', value: undefined, raw: 'undefined' }; }
						if (token.value === 'Infinity') { this.eat(); return { type: 'Literal', value: Infinity, raw: 'Infinity' }; }
						if (token.value === 'NaN') { this.eat(); return { type: 'Literal', value: NaN, raw: 'NaN' }; }

						// Check for async arrow: async (...) => or async id =>
						if (token.value === 'async') {
							var next = this.peekAt(1);
							if (next && (next.type === 'Identifier' || next.value === '(')) {
								this.eat(); // consume 'async'
								// Let the normal path build the expression; the => handler in
								// parseAssignmentExpression will convert it to ArrowFunctionExpression
								var inner = this.parseMemberExpression();
								if (this.peek().value === '=>') {
									this.eat('=>');
									var params = this.arrowParamsFromExpr(inner);
									var body = this.peek().value === '{'
										? this.parseBlock()
										: this.parseAssignmentExpression();
									return { type: 'ArrowFunctionExpression', params: params, body: body, async: true, expression: body.type !== 'BlockStatement' };
								}
								return inner;
							}
						}

						return { type: 'Identifier', name: this.eat().value };
					}

					// Grouped expression / arrow-function params
					if (token.value === '(') {
						this.eat('(');
						// Empty parens () � must be arrow function
						if (this.peek().value === ')') {
							this.eat(')');
							return { type: 'GroupExpression', argument: null };
						}
						var expr = this.parseExpression();
						this.eat(')');
						return { type: 'GroupExpression', argument: expr };
					}

					if (token.value === '[') return this.parseArrayLiteral();
					if (token.value === '{') return this.parseObjectLiteral();

					// FIX: `...` spread at atom level (e.g., inside array literals when called
					//      directly � normally caught by parseMaybeUnary but guard here too)
					if (token.value === '...') {
						this.eat('...');
						return { type: 'SpreadElement', argument: this.parseMaybeUnary() };
					}

					//console.log('parseAtom failed at token:', token, this);
					throw new Error('Unexpected token: ' + token.value + ' at ' + token.line + ':' + token.column);
				};

				script_gen.prototype.parseFunctionExpression = function () {
					this.eat('function');
					var generator = false;
					if (this.peek().value === '*') { this.eat('*'); generator = true; }
					var id = null;
					if (this.peek().type === 'Identifier') id = { type: 'Identifier', name: this.eat().value };
					this.eat('(');
					var params = this.parseParamList();
					this.eat(')');
					var body = this.parseBlock();
					return { type: 'FunctionExpression', id: id, params: params, body: body, generator: generator };
				};

				script_gen.prototype.parseArrayLiteral = function () {
					this.eat('[');
					var elems = [];
					while (this.peek().value !== ']') {
						if (this.peek().value === ',') {
							elems.push(null); // elision / hole
							this.eat(',');
							continue;
						}
						// FIX: spread inside array literal
						if (this.peek().value === '...') {
							this.eat('...');
							elems.push({ type: 'SpreadElement', argument: this.parseAssignmentExpression() });
						} else {
							// FIX: use parseAssignmentExpression so nested commas don't eat siblings
							elems.push(this.parseAssignmentExpression());
						}
						if (this.peek().value === ',') this.eat(','); else break;
					}
					this.eat(']');
					return { type: 'ArrayExpression', elements: elems };
				};

				script_gen.prototype.parseObjectLiteral = function () {
					this.eat('{');
					var props = [];
					while (this.peek().value !== '}') {
						// FIX: spread inside object literal: { ...obj }
						if (this.peek().value === '...') {
							this.eat('...');
							props.push({ type: 'SpreadElement', argument: this.parseAssignmentExpression() });
							if (this.peek().value === ',') this.eat(','); else break;
							continue;
						}

						var computed = false;
						var isGet = false, isSet = false;
						var isGenerator = false;
						var isAsync = false;

						// async method shorthand
						if (this.peek().type === 'Identifier' && this.peek().value === 'async' && this.peekAt(1).value !== ':' && this.peekAt(1).value !== ',') {
							this.eat(); isAsync = true;
						}
						// generator method shorthand: * key() {}
						if (this.peek().value === '*') {
							this.eat(); isGenerator = true;
						}
						// get/set accessor shorthand
						if (!isAsync && !isGenerator && this.peek().type === 'Identifier' &&
							(this.peek().value === 'get' || this.peek().value === 'set') &&
							this.peekAt(1).value !== ':' && this.peekAt(1).value !== ',' && this.peekAt(1).value !== '(') {
							var accessor = this.eat().value;
							isGet = accessor === 'get';
							isSet = accessor === 'set';
						}

						var key;
						if (this.peek().value === '[') {
							// Computed property: { [expr]: val }
							this.eat('[');
							key = this.parseAssignmentExpression();
							this.eat(']');
							computed = true;
						} else if (this.peek().type === 'Number') {
							var numTok = this.eat();
							key = { type: 'Literal', value: Number(numTok.value), raw: numTok.value };
						} else if (this.peek().type === 'String') {
							var strTok = this.eat();
							key = { type: 'Literal', value: strTok.value, raw: strTok.value };
						} else if (this.peek().type === 'Identifier' || this.peek().type === 'Keyword') {
							key = { type: 'Identifier', name: this.eat().value };
						} else {
							key = { type: 'Literal', value: this.peek().value, raw: this.eat().value };
						}

						var value;
						var shorthand = false;

						if (this.peek().value === '(') {
							// Method shorthand: { foo() {} }
							this.eat('(');
							var params = this.parseParamList();
							this.eat(')');
							var body = this.parseBlock();
							value = {
								type: isAsync ? 'AsyncFunctionExpression' : 'FunctionExpression',
								id: null, params: params, body: body, generator: isGenerator
							};
						} else if (this.peek().value === ':') {
							this.eat(':');
							// FIX: use parseAssignmentExpression so commas don't eat sibling properties
							value = this.parseAssignmentExpression();
						} else {
							// Shorthand property: { a } same as { a: a }
							shorthand = true;
							value = { type: 'Identifier', name: key.name || key.value };
						}

						// Default value in destructuring-like shorthand: { a = 1 }
						if (shorthand && this.peek().value === '=') {
							this.eat('=');
							value = { type: 'AssignmentPattern', left: value, right: this.parseAssignmentExpression() };
						}

						props.push({
							type: 'Property',
							key: key,
							value: value,
							computed: computed,
							shorthand: shorthand,
							kind: isGet ? 'get' : isSet ? 'set' : 'init'
						});
						if (this.peek().value === ',') this.eat(','); else break;
					}
					this.eat('}');
					return { type: 'ObjectExpression', properties: props };
				};

			})();

			// --- CODE GENERATOR ---

			function generate_code(node) {
				var _this = this;
				if (!node) return '';

				// Extension override hook
				if (_this.extensions && _this.extensions[node.type]) {
					var res = _this.extensions[node.type](node, _this.generate_code.bind(_this));
					if (res !== false) return res;
				}
				try {
					switch (node.type) {

						case 'Program':
							return node.body.map(_this.generate_code.bind(_this)).join('\n');

						case 'BlockStatement':
							return '{\n' + node.body
								.filter(Boolean)
								.map(_this.generate_code.bind(_this))
								.map(function (s) { return '  ' + s; })
								.join('\n') + '\n}';

						case 'EmptyStatement':
							return ';';

						case 'DebuggerStatement':
							return 'debugger;';

						case 'LabeledStatement':
							return _this.generate_code(node.label) + ': ' + _this.generate_code(node.body);

						case 'ExpressionStatement':
							return _this.generate_code(node.expression) + ';';

						case 'VariableDeclaration': {
							var list = node.declarations.filter(Boolean);
							if (list.length === 0) return '';
							return node.kind + ' ' + list.map(_this.generate_code.bind(_this)).join(', ') + ';';
						}

						case 'VariableDeclarator':
							return _this.generate_code(node.id) + (node.init ? ' = ' + _this.generate_code(node.init) : '');

						// --- Binding patterns ---
						case 'ObjectPattern': {
							var parts = node.properties.map(function (p) {
								if (p.type === 'RestElement') return '...' + _this.generate_code(p.argument);
								var k = _this.generate_code(p.key);
								var v = _this.generate_code(p.value);
								if (p.shorthand) return v; // { a } or { a = 1 }
								return (p.computed ? '[' + k + ']' : k) + ': ' + v;
							});
							return '{ ' + parts.join(', ') + ' }';
						}

						case 'ArrayPattern': {
							var parts = node.elements.map(function (e) {
								if (!e) return '';
								if (e.type === 'RestElement') return '...' + _this.generate_code(e.argument);
								return _this.generate_code(e);
							});
							return '[' + parts.join(', ') + ']';
						}

						case 'AssignmentPattern':
							return _this.generate_code(node.left) + ' = ' + _this.generate_code(node.right);

						case 'RestElement':
							return '...' + _this.generate_code(node.argument);

						// --- Control flow ---
						case 'IfStatement': {
							var str = 'if (' + _this.generate_code(node.test) + ') ' + _this.generate_code(node.consequent);
							if (node.alternate) str += ' else ' + _this.generate_code(node.alternate);
							return str;
						}

						case 'ForStatement': {
							var init = node.init ? _this.generate_code(node.init).replace(/;$/, '') : '';
							return 'for (' + init + '; ' +
								(node.test ? _this.generate_code(node.test) : '') + '; ' +
								(node.update ? _this.generate_code(node.update) : '') + ') ' +
								_this.generate_code(node.body);
						}

						case 'ForInStatement': {
							var left = (node.left.type === 'VariableDeclaration')
								? node.left.kind + ' ' + node.left.declarations.map(_this.generate_code.bind(_this)).join(', ')
								: _this.generate_code(node.left);
							return 'for (' + left + ' in ' + _this.generate_code(node.right) + ') ' + _this.generate_code(node.body);
						}

						case 'ForOfStatement': {
							var left = (node.left.type === 'VariableDeclaration')
								? node.left.kind + ' ' + node.left.declarations.map(_this.generate_code.bind(_this)).join(', ')
								: _this.generate_code(node.left);
							return 'for (' + left + ' of ' + _this.generate_code(node.right) + ') ' + _this.generate_code(node.body);
						}

						case 'WhileStatement':
							return 'while (' + _this.generate_code(node.test) + ') ' + _this.generate_code(node.body);

						case 'DoWhileStatement':
							return 'do ' + _this.generate_code(node.body) + ' while (' + _this.generate_code(node.test) + ');';

						case 'SwitchStatement': {
							var cases = node.cases.map(_this.generate_code.bind(_this)).join('\n');
							return 'switch (' + _this.generate_code(node.discriminant) + ') {\n' + cases + '\n}';
						}

						case 'SwitchCase': {
							var label = node.test ? 'case ' + _this.generate_code(node.test) + ':' : 'default:';
							var cons = node.consequent
								.filter(Boolean)
								.map(_this.generate_code.bind(_this))
								.map(function (s) { return '  ' + s; })
								.join('\n');
							return label + (cons ? '\n' + cons : '');
						}

						case 'ReturnStatement':
							return 'return' + (node.argument ? ' ' + _this.generate_code(node.argument) : '') + ';';

						case 'BreakStatement':
							return node.label ? 'break ' + _this.generate_code(node.label) + ';' : 'break;';

						case 'ContinueStatement':
							return node.label ? 'continue ' + _this.generate_code(node.label) + ';' : 'continue;';

						case 'ThrowStatement':
							return 'throw ' + _this.generate_code(node.argument) + ';';

						case 'TryStatement': {
							var str = 'try ' + _this.generate_code(node.block);
							if (node.handler) {
								str += ' catch';
								if (node.handler.param) str += ' (' + _this.generate_code(node.handler.param) + ')';
								str += ' ' + _this.generate_code(node.handler.body);
							}
							if (node.finalizer) str += ' finally ' + _this.generate_code(node.finalizer);
							return str;
						}

						// --- Expressions ---
						case 'SequenceExpression':
							return node.expressions.map(_this.generate_code.bind(_this)).join(', ');

						case 'ConditionalExpression':
							return _this.generate_code(node.test) + ' ? ' +
								_this.generate_code(node.consequent) + ' : ' +
								_this.generate_code(node.alternate);

						case 'BinaryExpression':
						case 'LogicalExpression':
						case 'AssignmentExpression': {
							var left = _this.generate_code(node.left);
							var right = _this.generate_code(node.right);
							var prec = PRECEDENCE[node.operator] || 0;
							var leftPrec = (node.left.type === 'BinaryExpression' || node.left.type === 'LogicalExpression')
								? (PRECEDENCE[node.left.operator] || 0)
								: (node.left.type === 'ConditionalExpression') ? PRECEDENCE['?'] : 99;
							var rightPrec = (node.right.type === 'BinaryExpression' || node.right.type === 'LogicalExpression')
								? (PRECEDENCE[node.right.operator] || 0)
								: (node.right.type === 'ConditionalExpression') ? PRECEDENCE['?'] : 99;
							if (leftPrec < prec) left = '(' + left + ')';
							if (rightPrec < prec) right = '(' + right + ')';
							return left + ' ' + node.operator + ' ' + right;
						}

						case 'UnaryExpression':
							return node.operator + (node.operator.length > 1 ? ' ' : '') + _this.generate_code(node.argument);

						case 'UpdateExpression':
							return node.prefix
								? node.operator + _this.generate_code(node.argument)
								: _this.generate_code(node.argument) + node.operator;

						case 'SpreadElement':
							return '...' + _this.generate_code(node.argument);

						case 'CallExpression':
						case 'OptionalCallExpression': {
							var callee = _this.generate_code(node.callee);
							if (callee) {
								if (node.callee.type === 'FunctionExpression') callee = '(' + callee + ')';
								var op = node.optional ? '?.' : '';
								return callee + op + '(' + node.arguments.map(_this.generate_code.bind(_this)).join(', ') + ')';
							}
							else return '';

						}

						case 'MemberExpression':
						case 'OptionalMemberExpression': {
							var obj = _this.generate_code(node.object);
							if (node.object.type === 'BinaryExpression') obj = '(' + obj + ')';
							var op = node.optional ? '?.' : '.';
							if (node.computed) return obj + '[' + _this.generate_code(node.property) + ']';
							return obj + op + (node.property.name || node.property.value);
						}

						case 'FunctionDeclaration':
						case 'FunctionExpression':
						case 'AsyncFunctionExpression': {
							var isAsync = node.async || node.type === 'AsyncFunctionExpression';
							var p = node.params.map(_this.generate_code.bind(_this)).join(', ');
							var id = node.id ? ' ' + node.id.name : '';
							var gen = node.generator ? '*' : '';
							return (isAsync ? 'async ' : '') + 'function' + gen + id + '(' + p + ') ' + _this.generate_code(node.body);
						}

						case 'ArrowFunctionExpression': {
							var p = node.params.length === 1 && node.params[0].type === 'Identifier'
								? node.params[0].name
								: '(' + node.params.map(_this.generate_code.bind(_this)).join(', ') + ')';
							var async = node.async ? 'async ' : '';
							var body = node.expression ? _this.generate_code(node.body) : _this.generate_code(node.body);
							return async + p + ' => ' + body;
						}

						case 'ArrayExpression':
							return '[' + node.elements.map(function (e) {
								return e ? _this.generate_code(e) : '';
							}).join(', ') + ']';

						case 'ObjectExpression': {
							var props = node.properties.map(function (p) {
								if (p.type === 'SpreadElement') return '...' + _this.generate_code(p.argument);
								var k = p.computed
									? '[' + _this.generate_code(p.key) + ']'
									: (p.key.name !== undefined ? p.key.name : _this.generate_code(p.key));
								if (p.shorthand) return _this.generate_code(p.value);
								if (p.value && (p.value.type === 'FunctionExpression' || p.value.type === 'AsyncFunctionExpression')) {
									var fn = p.value;
									var isAsync = fn.async || fn.type === 'AsyncFunctionExpression';
									var gen = fn.generator ? '*' : '';
									var params = fn.params.map(_this.generate_code.bind(_this)).join(', ');
									return (p.kind === 'get' ? 'get ' : p.kind === 'set' ? 'set ' : '') +
										(isAsync ? 'async ' : '') + gen + k + '(' + params + ') ' + _this.generate_code(fn.body);
								}
								return (p.kind === 'get' ? 'get ' : p.kind === 'set' ? 'set ' : '') +
									k + ': ' + _this.generate_code(p.value);
							});
							return '{ ' + props.join(', ') + ' }';
						}

						case 'MetaProperty':
							return node.meta.name + '.' + node.property.name;

						case 'Literal':
							return node.raw !== undefined ? String(node.raw) : String(node.value);

						case 'Identifier':
							return _this.get_identifier ? _this.get_identifier(node.name, node) : node.name;

						case 'ThisExpression':
							return 'this';

						case 'GroupExpression':
							return node.argument ? '(' + _this.generate_code(node.argument) + ')' : '()';

						case 'NewExpression': {
							var callee = _this.generate_code(node.callee);
							return 'new ' + callee + '(' + node.arguments.map(_this.generate_code.bind(_this)).join(', ') + ')';
						}

						default:
							console.warn('generate_code: unknown node type', node.type, node);
							return '';
					}

				} catch (ee) {
					//console.log("node", node);
					throw ee;
				}

			}

			return {
				Parser: script_gen,
				generate: generate_code,
				generate_code: generate_code,
			};

		})();


		(function () {

			script_gen.reset = function (get_identifier, extensions) {
				this.get_identifier = get_identifier;
				this.extensions = extensions;
				return this;
			};

			script_gen.identifiers = [];
			script_gen.push_identifiers = function (get_identifier) {
				if (this.get_identifier) this.identifiers.push(this.get_identifier);
				this.get_identifier = get_identifier;
			};
			script_gen.pop_identifiers = function () {
				this.get_identifier = this.identifiers.pop();
			};

			script_gen.collect_nodes = function (node, type, clear) {
				var list = [];
				function process_node(node, parent, key) {
					if (!node) return;
					if (node.type === type) {
						list.push(node);
						if (clear) {
							if (Array.isArray(parent)) parent[key] = undefined;
							else delete parent[key];
						}
					}
					for (var k in node) {
						var child = node[k];
						if (Array.isArray(child)) {
							child.forEach(function (ch, i) { process_node(ch, child, i); });
						} else if (child && typeof child === 'object' && child.type) {
							process_node(child, node, k);
						}
					}
				}
				process_node(node);
				return list;
			};

			script_gen.apply_features = function (node, features) {
				function set_parent(res, parent, key) {
					if (res === true) {
						if (Array.isArray(parent)) parent[key] = undefined;
						else delete parent[key];
					} else if (res !== false) {
						parent[key] = res;
					}
				}
				function process_node(node, parent, key) {
					if (!node) return;
					for (var k in node) {
						var child = node[k];
						if (Array.isArray(child)) {
							child.forEach(function (ch, i) { process_node(ch, child, i); });
						} else if (child && typeof child === 'object' && child.type) {
							if (child.type === 'CallExpression' && features[child.callee && child.callee.name]) {
								var res = features[child.callee.name](child, node, k);
								set_parent(res, parent, key);
							}
							process_node(child, node, k);
						}
					}
				}
				if (features) process_node(node);
			};

		})();

		const bundle_features = {};
		let constants;
		const bundle_extensions = {}, entry_extensions = {};
		function get_identifier(name, node) {
			if (constants[name] !== undefined) {
				return constants[name];
			}
			return name;
		}
		bundle_features["constants$"] = function (node) {
			node.arguments.forEach(function (arg) {

				if (arg.type == "BinaryExpression") {
					constants[arg.left] = eval(script_gen.generate_code(arg.right));
				}
				else if (arg.type == "ObjectExpression") {
					arg.properties.forEach(function (p) {
						//	console.log("p.key", p.key)
						if (constants[p.key.name] && p.key.name.indexOf("$") > 0) {
							constants[p.key.name] += eval(script_gen.generate_code(p.value));
						}
						else {
							constants[p.key.name] = eval(script_gen.generate_code(p.value));
						}


						//	console.log("constants$", p.key.name, constants[p.key.name]);
					})
				}


			});
			return true;
		};






		on_bundle.push((function () {

			return function (source, entry) {
				if (!entry) return source;
				return new Promise(function (resolve) {

					const sntry = entry.get_super_entry();
					sntry.packings$ = sntry.packings$ || [];
					sntry.blocks$ = sntry.blocks$ || {};
					sntry.__constants = sntry.__constants || {};
					sntry.__macros = sntry.__macros || {};
					sntry.__collects = sntry.__collects || {};
					const bundle_calls$ = {};
					bundle_extensions["CallExpression"] = function (node, print) {
						if (node.callee.type === 'Identifier') {
							let name = node.callee.name.trim();
							if (name == "bundle_calls$") {

								node.arguments.forEach(function (arg) {
									if (arg.type == "ObjectExpression") {
										arg.properties.forEach(function (p) {
											bundle_calls$[p.key.name] = new Function('return ' + script_gen.generate_code(p.value))();
											console.log(p.key.name, [bundle_calls$[p.key.name]]);

										});
									}
								});
								return '';
							}
							else if (bundle_calls$[name]) {
								return bundle_calls$[name](node, sntry, print);
							}
						}

						return false;
					};

					script_gen.reset(get_identifier, bundle_extensions);

					constants = sntry.__constants;
					_bundle_features = sntry.__bundle_features;
					sntry.__packages.forEach(function (p) {
						const e = packing.loaded[p];
						if (e && e.__constants) {
							for (let k in e.__constants) {
								constants[k] = e.__constants[k];
							}

						}

					})

					macros = sntry.__macros;
					collects = sntry.__collects;


					const scp = new script_gen.Parser(source);
					const ast = scp.parseProgram();
					script_gen.apply_features(ast, bundle_features);


					entry.__ast = ast;
					entry.__source = script_gen.generate(ast);

					const sconstants = Object.keys(constants).map(function (k) {
						return [k, constants[k], new RegExp(k.replace("$", ""), "g")];

					}).sort(function (a, b) {
						return b[0].length - a[0].length;
					});
					console.log("constants ", [sconstants]);



					const tasks = [];




					if (sntry.packings$.length > 0) {
						sntry.packings$.forEach(function (node, i) {
							tasks.push(function () {
								return new Promise(function (packing_complete) {
									node.callee.callee.name = "return packing.export_bundle";
									let letime = Date.now();
									const fsource = script_gen.generate_code(node);
									//console.log(fsource);
									(new Function(fsource)()({
										__constants: sntry.__constants
									})).then(function (bun) {
										entry.__source = entry.__source.replace('packing___' + (i + 1) + '()', bun);
										console.log("sntry.packings$", Date.now() - letime);
										packing_complete();
									});
								})

							});
						});

					}

					Object.keys(sntry.blocks$).forEach(function (ke) {
						const blk = sntry.blocks$[ke];
						let blk_source = blk.map(function (node) {
							return node;
						}).join('\n');
						sconstants.forEach(function (a) {
							blk_source = blk_source.replace(a[2], a[1]);
						});
						entry.__source = entry.__source.replace('call_blk_' + ke + '()', blk_source);

					});


				
					if (tasks.length > 0) {
						//	console.log("tasks", tasks);
						each(function (next_task, i) {
							if (i > tasks.length - 1) {
								resolve(entry.__source);
								return;
							}
							tasks[i]().then(function () {
								next_task(i + 1);
							});
						})
					}
					else {
						resolve(entry.__source);
					}

				});


			}


		})());
		const entry_features = {};
		function compile_entry(entry) {
			const sntry = entry.get_super_entry();


			return new Promise(function (resolve) {
				const source = entry.toString();

				parse_include(source, entry, entry.__base_folder, function (source) {

					sntry.packings$ = sntry.packings$ || [];
					sntry.blocks$ = sntry.blocks$ || {};
					entry_extensions["CallExpression"] = function (node, print) {
						if (node.callee.type === 'Identifier') {
							let name = node.callee.name.trim();
							if (name == "packing$") {
								sntry.packings$.push(node.arguments[0]);
								return 'packing___' + sntry.packings$.length + '()';
							}
							else if (name == "block$") {
								const arg = node.arguments[0];
								//console.log("block$", arg);
								if (arg.type == "Literal") {
									name = eval(arg.raw);
									sntry.blocks$[name] = sntry.blocks$[name] || [];
									return 'call_blk_' + name + '()';
								}
								else if (arg.type == "FunctionExpression") {
									name = arg.id.name.trim();
									sntry.blocks$[name] = sntry.blocks$[name] || [];
									sntry.blocks$[name].push(script_gen.generate_code(arg.body));
									return '';
								}



							}
						}

						return false;
					};

					script_gen.reset(undefined, entry_extensions);


					const scp = new script_gen.Parser(source);
					const ast = scp.parseProgram();

					source = script_gen.generate(ast);



					entry.__source = source;
					loaded[entry.__name] = entry;
					script_gen.apply_features(ast, entry_features);

					entry.__args = ast.body[0].params.map(function (p) { return p.name; });
					//console.log("compile_entry", entry.__name, ast);
					resolve(entry.__source);




				});

			})

		};

		return compile_entry;

	})();


	function wait_loading(name) {
		return new Promise(function (res) {
			function wait() {
				if (loaded[name] || loaded[loading[name]]) return res();
				setTimeout(wait, 20);
			}
			wait();
		});
	}

	function process_dep() {
		const entry = this;
		let dep = entry.___deps.pop();

		// console.log("dep", entry.__name, [entry,dep]);
		if (dep === undefined) {
			if (entry.__base_url) urlsnames[entry.__base_url] = entry.__name;
			if (entry_loaded(entry.__name)) {
				if (entry.__parent_entry !== undefined) {
					if (entry.__name !== '' && !entry.__is_child) {
						entry.__super_entry.__packages.push(entry.__name);
					}

					process_dep.apply(entry.__parent_entry);
				}
				return;
			};
			compile_entry(entry).then(function (source) {

				if (entry.__parent_entry !== undefined) {
					if (entry.__name !== '' && !entry.__is_child) entry.__parent_entry.__packages.push(entry.__name);
					process_dep.apply(entry.__parent_entry);
				}
				else if (entry.__caller) {
					//   console.log("completed", entry.__name);

					entry.__caller.__packages.push(entry.__name);
					process_dep.apply(entry.__caller);
				}
				else {
					export_entry(entry).then(function (bundle) {
						entry.__super_entry.on_bundle.forEach(function (BB) {
							bundle = BB(bundle);
						});
						bundle = bundle.replace(/\n\s*\n\s*\n/g, '\n\n');

						if (entry.__bundle_resolver) {
							entry.__bundle_resolver(bundle);
						}
						else {
							if (is_browser)
								packing.execute_bundle(bundle, entry);
							else
								entry.__exported_bundle = bundle;

						}
					});
				}
			});
			return;
		}

		if (dep == "packing") {
			entry.__super_entry.__include_packing = true;
			process_dep.apply(entry);
			return;
		}
		if (loaded[dep]) {
			entry.__packages.push(dep);
			process_dep.apply(entry);
			return;
		}

		else if (loaded[urlsnames[dep]]) {
			dep = urlsnames[dep];
			entry.__packages.push(dep);
			process_dep.apply(entry);
			return;
		}
		else if (loading[dep]) {

			if (entry.__parent_entry) {
				if (dep === entry.__parent_entry.__name) {
					return process_dep.apply(entry);
				}
			}
			wait_loading(dep).then(function () {
				entry.__packages.push(loading[dep]);
				process_dep.apply(entry);
			});
			return;
		}
		else if (loading[urlsnames[dep]]) {
			dep = urlsnames[dep];
			// console.log("wait for ", dep, entry.__name);
			wait_loading(dep).then(function () {
				entry.__packages.push(dep);
				process_dep.apply(entry);
			});
			return;
		}
		else if (!entry.__is_child && registry[dep]) {
			return entry.process_child_entry(cache[dep], [], dep);
		}


		if (is_function(dep)) {
			if (dep.create_source) {
				entry.process_child_entry(dep(), [], dep);

				return;
			}
			const resp = dep(entry);
			if (resp instanceof Promise) {
				resp.then(function () {
					process_dep.apply(entry);
				});
			} else {
				process_dep.apply(entry);
			}
			return;
		}
		else if (is_object(dep)) {
			Object.assign(entry, dep);
			process_dep.apply(entry);
			return;
		}
		else if (dep instanceof Promise) {
			dep.then(function () {
				process_dep.apply(entry);
			});
			return;
		}

		else if (is_string(dep)) {
			// console.log("dep", dep);

			if (loaded[dep]) {
				if (entry.__caller) {
					entry.__caller.__packages.push(entry.__name);
					return process_dep.apply(entry.__caller);
				}
			}
			else if (test_dep_js.test(dep)) {
				//console.log("fetching", dep);
				loading[dep] = true;
				entry.__super_entry.__packages_urls.push(dep);
				entry.__resolve(entry.__resolve_path(dep)).then(function (source) {
					entry.loading_url = dep;
					(new Function("__args", "packing", source))([], entry.__load_child_entry);
				});
			}
			else if (registry[dep]) {
				entry.process_child_entry(cache[dep], [], dep);
			}
			else {
				entry.__resolve(entry.__resolve_path(dep), "arraybuffer").then(function () {
					process_dep.apply(entry);
				});
			}
			return;
		}
		else if (Array.isArray(dep)) {

			if (dep.length == 1) {
				if (registry[dep[0]]) {
					return entry.process_child_entry(cache[dep[0]], dep.splice(1), dep);
				}

				if (is_string(dep[0]) && test_dep_js.test(dep[0])) {
					loading[dep[0]] = true;
					// console.log("fetching", dep[0]);
					entry.__resolve(entry.__resolve_path(dep[0])).then(function (source) {
						entry.loading_url = dep[0];
						entry.process_child_entry('(function(){  ' + source.trim() + '})()', dep.splice(1), dep);
					});
				}

				else if (registry[dep[0]]) {
					return entry.process_child_entry(cache[dep[0]], dep.splice(1), dep);
				}
			}
			else if (dep.length > 1) {
				if (is_function(dep[1])) {
					entry.__resources[dep[0]] = dep[1];
					process_dep.apply(entry);
					return;
				}

				else if (is_string(dep[1])) {
					entry.__resolve(entry.__resolve_path(dep[1]), dep[2] || "arraybuffer").then(function (data) {
						entry.__resources[dep[0]] = data;
						process_dep.apply(entry);
					});
				}
				else {
					entry.__resources[dep[0]] = dep[1];
					process_dep.apply(entry);
				}
			}



		}
		else {
			if (registry[dep]) {
				entry.process_child_entry(cache[dep], [], dep);
			}
			else {
				entry.__resolve(entry.__resolve_path(dep), "arraybuffer").then(function () {
					process_dep.apply(entry);
				});
			}

		}
	}

	packing = function () {


		const deps = arguments_to_array(arguments).reverse();
		let caller, loading_url;

		if (this.___deps) {
			caller = this;
		}
		loading_url = this.loading_url;

		let parent_entry = undefined;
		if (this.__uuid !== undefined) {
			parent_entry = this;
		}
		return function (name, entry) {


			if (entry === undefined) {
				entry = name;
				name = undefined;
			}
			if (entry === undefined) entry = function () { };



			entry.get_super_entry = function () {
				if (this.__super_entry.__uuid === this.__uuid) return this;
				return this.__super_entry.get_super_entry();
			};

			let aliases;
			if (Array.isArray(name)) {
				aliases = name;
				name = name[0];
				aliases.splice(0, 1);
			}
			if (parent_entry !== undefined) {
				if (loaded[name]) {
					parent_entry.__super_entry.__packings.push(name);

					process_dep.apply(parent_entry);
					return;
				}
			}

			entry.__uuid = guidi();
			entry.___deps = deps;
			entry.__no_deps = entry.___deps.length < 1;
			name = name || ("P" + entry.__uuid);
			entry.__name = name;
			entry.__caller = caller;

			if (entry_loaded(entry.__name)) {
				if (caller) {
					entry.__caller.__packings.push(entry.__name);

					process_dep.apply(entry.__caller);
					return;
				}
			}


			entry._require = _require;
			entry.__parent_entry = undefined;
			entry.__packages = [];
			entry.__resources = {};
			entry.__resolvers = {};
			entry.__store = {};
			entry.__resolve = resolve_resource;
			entry.on_bundle = on_bundle; //[];
			entry.__packages_urls = [];
			entry.__is_child = false;
			entry.__children = [];
			entry.compilers = packing.compilers;
			entry.__compressed = false;
			entry.__aliases = aliases || [];
			entry.__base_url = loading_url || "";
			entry.__resolve_path = resolve_path;
			entry.__super_entry = entry;

			entry.FS$ = function (func) {
				let s = func.toString();
				let i = s.indexOf("{") + 1;
				return s.substr(i, s.length - i - 1).trim();
			};


			if (parent_entry) {
				entry.__super_entry = parent_entry.__parent_entry || parent_entry;
				if (name.indexOf(".") > 0) {
					if (name.substr(0, name.indexOf(".")) === parent_entry.__name) {
						entry.__parent_entry = parent_entry;
						entry.__is_child = true;
						entry.__parent_uuid = parent_entry.__uuid;
						entry.__base_url = parent_entry.__base_folder + entry.__base_url;
						parent_entry.__children.push(name);
					}

				}
			}

			entry.__base_folder = entry.__base_url.replace(entry.__base_url.replace(/^.*[\\\/]/, ''), "").replace("@", root_url);


			loading[entry.__name] = entry.__name;
			entry.__aliases.forEach(function (a) {
				loading[a] = entry.__name;
			});
			loading[entry.__base_url] = entry.__name;
			entry.__load_child_entry = function () {
				return packing.apply(entry, arguments);
			};


			entry.__load_child_entry.loaded = packing.loaded;
			entry.__load_child_entry.remove_packings = packing.remove_packings;
			entry.__load_child_entry.bundle = packing.bundle;
			entry.__load_child_entry.run_bundle = packing.run_bundle;
			entry.__load_child_entry.keywords = packing.keywords;
			entry.__load_child_entry.compilers = packing.compilers;
			entry.__load_child_entry.cache = packing.cache;
			entry.__load_child_entry.registry = packing.registry;
			entry.__load_child_entry.each = packing.each;
			entry.__load_child_entry.sleep = packing.sleep;
			entry.__load_child_entry.wait_loading = packing.wait_loading;
			entry.__load_child_entry.register = packing.register;
			entry.__load_child_entry.str_hash = packing.str_hash;


			entry.__load_child_entry.save_retores_state = function () { };


			entry.__load_child_entry.str_to_base64 = packing.str_to_base64;
			entry.__load_child_entry.base64_to_str = packing.base64_to_str;

			entry.__load_child_entry.get_super_entry = function () {
				if (entry.__super_entry.__uuid === entry.__uuid) return entry;
				return entry.__super_entry.get_super_entry();
			};

			entry.get_bundle = function () {
				return new Promise(function (__bundle_resolver) {

					if (entry.__exported_bundle) {
						return __bundle_resolver(entry.__exported_bundle);
					}
					entry.__bundle_resolver = __bundle_resolver;

				});
			};

			entry.execute_bundle = function (helement, params) {
				return new Promise(function (resolve) {
					entry.__bundle_resolver = function (bundle) {
						resolve(packing.execute_bundle(bundle, helement, params));
					};
				});
			};
			entry.process_child_entry = function (source, args, dep) {
				(new Function("__args", "packing", source))(args || [], this.__load_child_entry);

			};

			entry.get_html_element = function (params) {

				const dv = document.createElement("div");
				dv.style.width = "100%";
				dv.style.height = "100%";




				return new Promise(function (resolve) {
					entry.__bundle_resolver = function (bundle) {
						packing.execute_bundle(bundle, dv, params);
						delete loaded[entry.__name];
						resolve(dv);
					}
				})

			}

			process_dep.apply(entry);



			return entry;


		}



	}


	function remove_entry(e) {
		// console.log("removing", e.__name, e.__children.join());


		delete loaded[e.__name];
		delete loading[e.__name];
		delete loading[e.__base_url];
		delete urlsnames[e.__name];
		delete urlsnames[e.__base_url];
		delete registry[e.__name];
		delete cache[e.__base_url.replace("@", "")];
		e.__children.forEach(function (n) {

			let e = loaded[n];
			if (e) {
				// console.log("rc", n, [e]);

				delete loaded[e.__name];
				delete loading[e.__name];
				delete loading[e.__base_url];
				delete urlsnames[e.__name];
				delete urlsnames[e.__base_url];
				delete registry[e.__name];

			}


			// delete urlsnames[n];
		})
	}



	function save_retores_state(restore, with_cache) {

		if (restore) {
			const state = save_retores_state.states.pop();
			restore_object(loaded, state['loaded']);
			loaded[true] = false;
			restore_object(loading, state['loading']);
			restore_object(keywords, state['keywords']);
			restore_object(urlsnames, state['urlsnames']);
			//constants.replacer = state['constants'];
			if (state['cache']) restore_object(cache, state['cache']);
			//console.log("retores_state", state);
		}
		else {
			const state = {};
			state['loaded'] = empty_object(loaded);
			state['loading'] = empty_object(loading);
			state['keywords'] = empty_object(keywords);
			state['urlsnames'] = empty_object(urlsnames);
			//state['constants'] = _constants.replacer.slice();
			if (with_cache) {
				state['cache'] = {};
				Object.assign(state['cache'], cache);

			}
			//console.log(loaded, loading, keywords, urlsnames);
			//console.log("save_state", state);

			save_retores_state.states.push(state);
		}

	}
	save_retores_state.states = [];

	packing.save_retores_state = save_retores_state;


	packing.export_bundle = function () {
		const self = this;
		const args1 = arguments_to_array(arguments);
		//this.loading_url = "";
		return function () {

			const args2 = arguments_to_array(arguments);
			return function (ext) {
				save_retores_state(false, !true);
				return new Promise(function (resolve) {
					const entr = packing.apply(self, args1).apply(self, args2);
					if (ext) Object.assign(entr, ext);
					entr.get_bundle().then(function (b) {

						save_retores_state(true, !true);
						resolve(b);
					});


				});
			}
		}
	};


	packing.run_bundle = function () {
		const self = this;
		//this.loading_url = "";
		const args1 = arguments_to_array(arguments);
		return function () {
			const args2 = arguments_to_array(arguments);
			return function (entry) {
				save_retores_state();
				return new Promise(function (resolve) {
					const entr = packing.apply(self, args1).apply(self, args2);
					save_retores_state(true);
					entr.execute_bundle().then(function (b) {
						resolve(b);
					});
				});
			}
		}
	};

	packing.execute_bundle = function (bundle, helement, params) {
		const resp = (new Function("packing", "require", "helement", "params", "return " + bundle))(packing, _require, helement, params);
		return resp;
	};



	packing.remove_entries = function () {
		let names = arguments_to_array(arguments);
		if (Array.isArray(names[0])) {
			names = names[0];
		}
		names.forEach(function (n) {
			if (loaded[n]) {
				remove_entry(loaded[n]);
			}
		});
	}

	packing.remove_package = function (url) {
		for (let name in loaded) {
			if (loaded[name].__base_url === url) {
				packing.remove_entries(name);
			}
		}
	};

	packing.globals = globals;
	packing.on_bundle = on_bundle;
	packing.wait_loading = wait_loading;
	packing.cache = cache;
	packing.compilers = compilers;
	packing.keywords = keywords;
	packing.loaded = loaded;
	packing.registry = registry;
	packing.sleep = sleep;
	packing.loading = loading;
	packing.urlsnames = urlsnames;
	packing.str_to_base64 = str_to_base64;
	packing.base64_to_str = base64_to_str;


	packing.register = function (name, func) {
		cache[name] = '(' + func.toString() + ')()';
		registry[name] = name;
	};


	packing.register("guid", function () {
		packing()("guid", function () {
			let guidCounter = 0;
			function create() {
				return (1024 + guidCounter++);
			};


			create.new = function (prefix) {
				prefix = prefix || "";
				let guidCounter = 0;
				return function () {
					return prefix + (Date.now() + guidCounter++);
				}
			}

			return create;

		});
	});

	packing.register("http", function () {
		packing()("http", function () {
			const http = require('http');
			const fs = require('fs');
			const path = require('path');
			const str_hash = function (str) {
				str = str.toString();
				let hash = 0, i, chr;
				if (str.length === 0) return hash;
				for (i = 0; i < str.length; i++) {
					chr = str.charCodeAt(i);
					hash = ((hash << 5) - hash) + chr;
					hash |= 0;
				}
				return hash + (2147483648);
			};

			const arguments_to_array = function (args) {
				let arr = [];
				args = args || [];
				for (let i = 0; i < args.length; i++)
					arr.push(args[i]);

				return arr;

			};

			this.serve = (function () {
				const MIME_TYPES = {
					default: 'application/octet-stream',
					json: 'application/json',
					html: 'text/html; charset=UTF-8',
					js: 'application/javascript; charset=UTF-8',
					css: 'text/css',
					png: 'image/png',
					jpg: 'image/jpg',
					gif: 'image/gif',
					ico: 'image/x-icon',
					svg: 'image/svg+xml',
					wasm: 'application/wasm',

				};
				return function (host, port, root_url) {

					const url = require('url');
					const server = http.createServer();
					server.root_dir = root_url || process.cwd();

					let i, route;

					server.on_request_upgrade = function (req, socket, head) {

					};
					server.on('upgrade', function (req, socket, head) {
						server.on_request_upgrade(req, socket, head);
					});

					server.routes = [];
					server.set_route = function (method, rg, cb) {
						for (i = 0; i < this.routes.length; i++) {
							route = this.routes[i];
							if (route[0] === method && route[1] === rg) {
								route[2] = cb;
								return;
							}
						}
						this.routes.push([method, rg, cb]);
					}
					server.gets = {};
					server.get = function (name) {
						if (name instanceof RegExp) {
							return this.set_route("GET", name, arguments_to_array(arguments));
						}
						this.gets[name] = arguments_to_array(arguments);
					};
					server.posts = {};
					server.post = function (name) {
						if (name instanceof RegExp) {
							return set_route("POST", name, arguments_to_array(arguments));
						}
						this.posts[name] = arguments_to_array(arguments);

					};
					server.cbody = [];
					server.chunk = function (chunk) {
						this.server.cbody[this.server.cbody.length] = chunk;
					};
					server.end = function () {
						this.body_buffer = Buffer.concat(this.server.cbody);
						this.server.cbody.length = 0;
						this.server = undefined;
					};
					server.complete = function (val) {
						if (val) this.res.end(val);
						this.req.waiting = false;
						this.free();
						return this;
					}
					server.status = function (code, text) {
						this.res.statusCode = code;
						if (text) {
							this.res.end(text);
						}


						return this;
					};
					server.header = function (name, value) {
						this.res.setHeader(name, value);
						return this;
					};

					server.mime = function (fn) {
						this.content_type(MIME_TYPES[path.extname(fn).substring(1).toLowerCase()]);
					}
					server.content_type = function (type) {
						this.header("Content-Type", type || MIME_TYPES.default);
						return this;
					};
					server.release = function () {
						this.waiting = false;
						return this;
					};
					server.file = function (fn) {
						if (fs.existsSync(fn)) {
							this.content_type(MIME_TYPES[path.extname(fn).substring(1).toLowerCase()]);
							this.header("Accept-Ranges", "bytes");


							fs.createReadStream(fn).pipe(this.res);
						}
						else {
							this.status(404).complete("Not found");
						}


					};

					server.json = function (j) {
						this.content_type(MIME_TYPES.json).complete(JSON.stringify(j));
					};

					server.free = function () {
						if (this.req.waiting) return;
						this.req = undefined;
						//this.res = undefined;
						this.cb = undefined;
					};
					let ret;
					server.next = function () {
						this.index++;
						if (this.index < this.cb.length) {
							ret = this.cb[this.index](this.req, this.res, this);
							if (ret === false) {
								this.index = Infinity;
								this.res.end();
								this.free();
							}
							if (ret == true) {
								this.req.waiting = true;
								//	console.log("waiting for server complete");
								return;
							}
						}
						else {
							this.res.end();
						}


						if (ret !== true) {
							if (this.cb && this.index + 1 == this.cb.length) {
								this.free();
							}
						}


					};

					let _url;
					server.on('request', function (req, res) {
						_url = url.parse(req.url, true);



						if (_url.pathname.indexOf("com.chrome.devtools") > 0) {
							//	console.log("request", _url.pathname);
							//server.status(404, "Bad request " + req.url);
							res.end();
							return;
						}

						if (_url.search) req.search = _url.search.replace("?", "");

						server.req = req;
						server.res = res;
						if (req.method === "GET") {
							server.cb = server.gets[_url.pathname];
						}
						else if (req.method === "POST") {
							server.cb = server.posts[_url.pathname];
						}

						if (!server.cb) {
							for (i = 0; i < server.routes.length; i++) {
								route = server.routes[i];
								if (route[0] === req.method) {
									if (route[1].test(_url.pathname)) {
										server.cb = route[2];

									}
								}
							}

						}

						if (server.cb) {

							res.statusCode = 200;
							req.url = _url;
							if (req.method === "POST") {
								server.cbody.length = 0;
								req.server = server;
								req.on('data', server.chunk);
								req.on('end', server.end);
							}

							server.index = 0;
							server.next();
						} else {
							server.status(404, "Bad request " + req.url).complete();
						}

					});


					server.cors = function (req, res, server) {

						res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
						res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
						res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
						res.setHeader("Access-Control-Allow-Origin", "*");
						res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST, GET");
						res.setHeader("Access-Control-Max-Age", 2592000);
						if (req.method === 'OPTIONS') {

							res.end();

						}
						server.next();
					};

					server.static_files = function (req, res, server) {


						let fn;
						try { fn = path.resolve(server.root_dir, "." + decodeURIComponent(req.url.pathname)); } catch (e) { return server.status(400, "Bad request").complete(); }
						const root = path.resolve(server.root_dir);
						if (fn !== root && fn.indexOf(root + path.sep) !== 0 || fn.indexOf(" ") >= 0) return server.status(403, "Forbidden").complete();
						server.file(fn);
					}

					server.get(/.*\.js|.*\.html|.*\.*/, server.cors, server.static_files);


					server.get(/.*\.jh/, server.cors, function (req, res, server) {
						const jname = req.url.pathname.replace(".jh", ".js");
						server.complete('<!DOCTYPE html><html><head><meta charset="utf-8" /><title>' + req.url.pathname + '</title><script src="/packing.js"></' + 'script><' + 'script src="' + jname + '"></' + 'script></head><body style="padding:0;margin:0;overflow:hidden;width:100vw;height:100vh"><img src="" id="test_tile" style="position:absolute;display:none"/></body></html>');
					});

					server.host = host;
					server.port = port;
					server.fs = fs;
					server.on("error", function (err) {
						if (err && err.code === "EADDRINUSE") console.error("packing: port " + port + " on " + host + " is already in use: give -serve another port (-serve 0 takes any free one)");
						else if (err && err.code === "EACCES") console.error("packing: no permission for port " + port + " on " + host + ": give -serve a port above 1023");
						else if (err && err.code === "EADDRNOTAVAIL") console.error("packing: " + host + " is not an address of this machine");
						else console.error("packing: server error", err);
						process.exit(1);
					});
					server.on("listening", function () {
						server.port = server.address().port;
						console.log("packing: serving " + server.root_dir + " at http://" + (host === "0.0.0.0" || host === "::" ? "localhost" : host) + ":" + server.port + "/");
					});
					setTimeout(function () {
						console.log(host, port, server.root_dir);
						server.listen(port, host);

					}, 50);

					return server;
				}

			})();

			return this;
		});
	});

	packing.register("http.basic_server", function () {

		packing("http")("http.basic_server", function (http) {

			http.basic_server = function (s, opts) {
				// -serve: "default" (127.0.0.1:8099) | PORT | HOST:PORT | :PORT.  opts: { port, host, root }: the command line's -port, -host and -root
				opts = opts || {};
				s = (s === undefined || s === null || s === true || s === "") ? "default" : String(s);
				let host = "127.0.0.1", port = 8099;
				if (s !== "default") {
					if (/^\d+$/.test(s)) port = parseInt(s, 10);
					else {
						const c = s.lastIndexOf(":");
						if (c < 0) host = s;
						else { if (c > 0) host = s.slice(0, c); port = parseInt(s.slice(c + 1), 10); }
					}
				}
				if (opts.host) host = String(opts.host);
				if (opts.port !== undefined && opts.port !== "") port = parseInt(opts.port, 10);
				host = host.replace(/^\[|\]$/g, "");
				if (!isFinite(port) || port < 0 || port > 65535) {
					console.error('packing: bad port in -serve "' + s + '": use default, a port, host:port or :port');
					process.exit(1);
				}
				const server = http.serve(host, port, opts.root);

				return server;
			}

		});
	});

	packing.register("httprequest", function () {

		packing()("httprequest", function () {
			const httprequest = this;
			const each = function (callback, index) {
				const func = function (index) {
					callback(func, index);
				};
				func(index || 0);
			};

			//@cmdline get_url get_urls http_func

			if (typeof XMLHttpRequest != "undefined") {



				httprequest.get_url = function (url, type, post_data, content_type) {

					//console.log("httprequest", url);
					return new Promise(function (resolve) {
						const xtp = new XMLHttpRequest();
						xtp.onload = function () {
							resolve(this.response);
							this.abort();
						};
						xtp.onerror = function () {
							console.log("onerror", this.response);
						};
						xtp.responseType = type || "text";

						if (post_data) {
							xtp.open("POST", url, !0);
							if (content_type)
								xtp.setRequestHeader('Content-Type', content_type);
							else {
								xtp.setRequestHeader('Content-Type', 'application/octet-stream');
							}
							xtp.send(post_data);
						}
						else {

							xtp.open("GET", url, true);
							xtp.send();
						}

					});
				};

				httprequest.get_urls = function (urls, type) {
					return new Promise(function (completed) {
						if (Array.isArray(urls)) {
							const loaded = [];
							each(function (next, i) {
								if (i > urls.length - 1) {
									completed(loaded);
									return;
								}
								else {
									if (Array.isArray(urls[i])) {
										httprequest.get_url(urls[i][0], urls[i][1]).then(function (data) {
											loaded[i] = data;
											next(i + 1);
										});
									}
									else {
										httprequest.get_url(urls[i]).then(function (data) {
											loaded[i] = data;
											next(i + 1);
										});
									}

								}
							});

						}
						else {
							httprequest.get_url(urls, type).then(function (data) {
								completed(data);
							});
						}




					});
				};

			}
			else {
				const http = require('http');
				const https = require('https');
				const fs = require('fs');
				const path = require('path');
				httprequest.get_url = function (url, type, post_data, content_type) {

					return new Promise(function (resolve) {
						url = url.trim();
						if (url.indexOf('http://') == 0) {
							if (post_data) {
								const req = http.request({
									method: "post",
									url: url

								});
								req.write(post_data);
								req.end();
							}
							else {
								http.get(url, function (res) {
									let data = [];
									res.on('data', function (chunk) {
										data.push(chunk);
									});

									res.on('end', function () {
										if (type == "text") {
											resolve(Buffer.concat(data).toString());
										}
										else {
											resolve(Buffer.concat(data));
										}
									});

								});
							}


						}
						else if (url.indexOf('https://') == 0) {
							if (post_data) {
								const req = https.request({
									method: "post",
									url: url

								});
								req.write(post_data);
								req.end();
							}
							else {
								https.get(url, function (res) {
									let data = [];
									res.on('data', function (chunk) {
										data.push(chunk);
									});
									res.on('end', function () {
										if (type == "text") {
											resolve(Buffer.concat(data).toString());
										}
										else {
											resolve(Buffer.concat(data).buffer);
										}

									});
								});
							}

						}
						else {
							if (url.indexOf(root_url) < 0) url = path.join(root_url, url);
							if (fs.existsSync(url)) {
								resolve(fs.readFileSync(url, { encoding: type === undefined ? "utf8" : type }));
							}
							else {
								console.log("url not found", url);
								resolve("Error not found", url)
							}
						}
					});
				};
			}

			return httprequest;

		});
	});

	packing.register("queue", function () {
		packing("define")("queue", function (define) {
			const queue = define(function (proto) {

				proto.size = function () {
					return this._newestIndex - this._oldestIndex;
				};
				proto.enqueue = function (data) {
					this._storage[this._newestIndex++] = data;
					return data;
				};

				proto.realign = function () {
					let count = this.size();
					let i = 0;
					for (i = 0; i < count; i++) {
						this._storage[i + 1] = this._storage[this._oldestIndex + i];
					}
					for (i = this._oldestIndex; i < this._newestIndex; i++) {
						this._storage[i] = undefined;
					}

					this._oldestIndex = 1;
					this._newestIndex = this._oldestIndex + count;
				};


				proto.dequeue = function () {
					if (this._oldestIndex !== this._newestIndex) {
						let deletedData = this._storage[this._oldestIndex];
						this._storage[this._oldestIndex++] = undefined;
						return deletedData;
					}
				};

				proto.fast_dequeue = function () {
					return this._storage[this._oldestIndex++];
				};

				proto.peek = function () {
					return this._storage[this._oldestIndex];
				};

				return function queue() {
					this._oldestIndex = 1;
					this._newestIndex = 1;
					this._storage = {};
				}

			});

			return queue;

		});
	});

	packing.register("stack", function () {
		packing("define")("stack", function (define) {
			const stack = define(function (proto) {




				proto.push = function (item) {
					this.data[this.index++] = item;
				};

				proto.pop = function () {
					if (this.index > 0) {
						const item = this.data[--this.index];
						this.data[this.index] = undefined;
						return item;

					}
					return undefined;
				};
				proto.peek = function () {
					return this.data[this.index - 1];
				}
				proto.reset = function () {
					this.index = 0;
				}
				function stack() {
					this.data = [];
					this.index = 0;

				}

				let prop_stack;
				stack.push_prop = function (obj, prop, value) {
					prop_stack = obj[prop + "_stack"];


					if (prop_stack === undefined) {
						prop_stack = new stack();
						obj[prop + "_stack"] = prop_stack;
					}
					prop_stack.push(obj[prop]);
					prop_stack = undefined;
					obj[prop] = value;
					return value;
				};

				stack.pop_prop = function (obj, prop) {
					prop_stack = obj[prop + "_stack"];
					if (prop_stack !== undefined) {
						obj[prop] = prop_stack.pop();
					}
					prop_stack = undefined;
					return obj[prop];


				};

				return stack;


			});
			return stack;

		});
	});

	packing.register("ds_array", function () {
		packing("define")("ds_array", function (define) {
			const ds_array = define(function (proto) {

				proto.push = function (element) {
					this.data[this.length++] = element;
					return this;
				};
				proto.push2 = function (e1, e2) {
					this.data[this.length++] = e1;
					this.data[this.length++] = e2;
					return this;
				};

				proto.push3 = function (e1, e2, e3) {
					this.data[this.length++] = e1;
					this.data[this.length++] = e2;
					this.data[this.length++] = e3;
					return this;
				};

				proto.push4 = function (e1, e2, e3, e4) {
					this.data[this.length++] = e1;
					this.data[this.length++] = e2;
					this.data[this.length++] = e3;
					this.data[this.length++] = e4;
					return this;
				};

				proto.push5 = function (e1, e2, e3, e4, e5) {

					this.data[this.length++] = e1;
					this.data[this.length++] = e2;
					this.data[this.length++] = e3;
					this.data[this.length++] = e4;
					this.data[this.length++] = e5;
					return this;
				};

				let i = 0;
				proto.push_args = function () {
					for (i = 0; i < arguments.length; i++)
						this.data[this.length++] = arguments[i];
				}

				proto.append_other = function (other) {
					for (i = 0; i < other.length; i++) {
						this.data[this.length++] = other.data[i];
					}
				}
				proto.peek = function () {
					return this.data[this.length - 1];
				};

				proto.pop = function () {
					if (this.length === 0) return null;
					return this.data[--this.length];
				};

				proto.clear = function () {
					this.length = 0;
				};

				proto.for_each = function (cb, self) {
					this.index = 0;
					while (this.index < this.length) {
						cb(this.data[this.index], this.index++, self);
					}
					this.index = 0;
				};

				proto.next = function () {
					if (this.index < this.length) {
						return this.data[this.index++];
					}
					return null;

				};
				proto.float32Array = function () {
					let f = new Float32Array(this.length);
					for (i = 0; i < this.length; i++)
						f[i] = this.data[i];

					return f;
				}
				return function ds_array(data) {
					this.data = data || [];
					this.length = 0;
					this.index = 0;
				}

			});
			return ds_array;

		});
	});

	packing.register("object_pooler", function () {
		packing("define")("object_pooler", function (define) {
			const object_pooler = define(function (proto) {



				proto.get = function (params) {
					if (this.freed > 0) {
						if (this.reuse)
							return this.reuse(this.free_objects[--this.freed], params);
						else
							return this.free_objects[--this.freed];
					}
					else {
						if (this.allocated >= this.pool_size) return null
						this.allocated++;
						return this.creator(params);
					}

				};
				proto.free = function (obj) {
					this.free_objects[this.freed++] = obj;
				};
				function object_pooler(creator, reuse, pool_size) {
					this.creator = creator;
					this.reuse = reuse;
					this.allocated = 0;
					this.freed = 0;
					this.pool_size = pool_size || Infinity;
					this.free_objects = [];
				};


				object_pooler.pools = function (creator) {
					let pools = {};
					function create_pool(key) {
						let pool = new object_pooler(creator);
						pools[key] = pool;
						return pool;
					}
					return function (key) {
						return pools[key] || create_pool(key);
					}
				};

				return object_pooler;
			});

			return object_pooler;

		});
	});



	packing.register("httprequest.data_keeper", function () {
		packing("events", "httprequest", "object_pooler", "queue", "object_pooler")("httprequest.data_keeper", function (httprequest, events, define, object_pooler, queue) {



			httprequest.bulk_url_loader = define(function (proto) {
				const items_pool = new object_pooler(function () {
					return [];
				});

				let item;

				proto.load = function (url, type, post_data, content_type) {
					const xtp = this.pool.get();

					if (xtp === null) {
						item = items_pool.get();
						item[0] = url;
						item[1] = type;
						item[2] = post_data;
						item[3] = content_type;

						this.park.enqueue(item);
						return;
					}
					xtp.manager = this;
					xtp.responseType = type || "arraybuffer";
					xtp.isBusy = true;
					xtp.url = url;

					if (post_data) {
						xtp.open("POST", url, !0);
						if (content_type)
							xtp.setRequestHeader('Content-Type', content_type);
						else {
							xtp.setRequestHeader('Content-Type', 'application/octet-stream');
						}
						xtp.send(post_data);
					}
					else {
						xtp.open("GET", url, !0);
						xtp.send();
					}


				};

				proto.check_park = function () {
					if (this.park.size() > 0) {
						item = this.park.dequeue();
						items_pool.free(item);
						this.load.apply(this, item);
						item[2] = undefined;
					}
				};

				proto.free = function (xtp) {
					this.pool.free(xtp);
					xtp.url = undefined;
					xtp.manager = undefined;
					this.check_park();
				};
				proto.onload = function () {

				}
				return function (pool_size) {
					this.park = new queue();
					this.pool = new object_pooler(function () {
						if (this.allocated <= this.max_size) {
							var xtp = new XMLHttpRequest();

							xtp.onload = function () {
								if (!this.manager) return;
								this.manager.onload(this.response, this.url);
								this.abort();
								this.isBusy = false;
								if (this.manager && this.manager.auto_free) this.manager.free(this);
							};

							return xtp
						}
						this.allocated--;
						return null;
					});

					this.pool.max_size = pool_size;
					this.auto_free = true;
					return this;


				}




			});

			const data_keeper = define(function (proto) {
				proto.get_data = function (url) {
					if (this.data_loading[url]) {
						if (this.data_loading[url].loaded) {
							this.data_loading[url].last_time = Date.now();
							return this.data_loading[url];
						}
					}
					else {
						this.data_loading[url] = this.data_pool.get(url);
						this.data_loading[url].last_time = Date.now();
						return undefined;
					}
				}

				let url, deleted = [], di;
				proto.clean_up = function () {
					di = 0;
					for (url in this.data_loading) {
						if (this.data_loading[url].loaded) {
							if (Date.now() - this.data_loading[url].last_time > this.clean_up_time) {
								deleted[di++] = url;
							}
						}
					}

					if (di > 0) {
						while (di > 0) {
							url = deleted[--di];
							this.data_loading[url].loaded = false;
							this.data_pool.free(this.data_loading[url]);
							delete this.data_loading[url];
						}
						//console.log(Object.keys(this.data_loading).length, "data keeper free");
					}
				};
				proto.on_data_loaded = function (data) { }



				return function data_keeper(create_data, reuse_data, clean_up_time) {
					this.data_loading = {};
					this.clean_up_time = clean_up_time || 3000;
					this.data_pool = new object_pooler(create_data || function (url) { }, reuse_data);
					this.on_loading = new events.event(this, [null]);
				};
			});


			data_keeper.datas = (function () {

				return function (nums) {
					let dta;
					const data_loader = new httprequest.bulk_url_loader(nums || 8);
					const data_keeper = new httprequest.data_keeper(
						function (url) { data_loader.load(url); return {}; },
						function (dta, url) { data_loader.load(url); dta.loaded = false; return dta; }
					);
					data_loader.onload = function (data, url) {
						dta = data_keeper.data_loading[url];
						if (dta) {
							dta.data = data;
							dta.loaded = true;
							dta.url = url;
							dta.last_time = 0;
							data_keeper.on_loading.params[0] = dta;
							data_keeper.on_loading.trigger_params();
						}
					};
					return data_keeper;
				}

			})();

			data_keeper.images = (function () {

				return function () {
					const images_loader = new httprequest.data_keeper(
						function (url) {
							const img = new Image();
							img.crossOrigin = "Anonymous";
							img.onload = function () {
								img.loaded = true;
								images_loader.on_loading.params[0] = img;
								images_loader.on_loading.trigger_params();
							};
							img.src = url;
							return img;
						},
						function (img, url) {
							img.loaded = false;
							img.src = url;
							return img;
						}
					);
					return images_loader;
				}

			})();

			httprequest.data_keeper = data_keeper;


		});
	});

	packing.register("define", function () {

		packing()("define", function () {

			const is_function = function (obj) {
				return !!(obj && obj.constructor && obj.call && obj.apply);
			};
			const define = function (_creator, _super) {
				_super = _super || Object;
				let proto = {};
				Object.assign(proto, _super.prototype);
				proto.override = function (orig) {
					return function (defi) {
						proto[orig.fname] = defi(orig);
					}
				};
				let _class = _creator(proto, _super);
				_class.class_name = _creator.name;
				_class.super_class = _super;
				let k;
				for (k in proto) {
					if (is_function(proto[k])) {
						proto[k].fname = k;
					}
				}

				for (k in _super) {
					if (is_function(_super[k])) {
						if (_class[k] === undefined) _class[k] = _super[k];
					}
				}
				_class.prototype = Object.create(_super.prototype);
				Object.assign(_class.prototype, proto);
				return (_class);
			};

			define.is_function = is_function;

			define.is_string = function (x) {
				return Object.prototype.toString.call(x) === "[object String]"
			};

			define.is_object = function (x) {
				return Object.prototype.toString.call(x).toLocaleLowerCase() === '[object object]'
			};



			//@cmdline is_object is_string is_function
			return define;



		});
	});


	packing.register("webgl2_context", function () {

		packing()("webgl2_context", function () {

			constants$({
				KBD_KEY_CANCEL: 3,
				KBD_KEY_HELP: 6,
				KBD_KEY_BACK_SPACE: 8,
				KBD_KEY_TAB: 9,
				KBD_KEY_CLEAR: 12,
				KBD_KEY_RETURN: 13,
				KBD_KEY_ENTER: 14,
				KBD_KEY_SHIFT: 16,
				KBD_KEY_CONTROL: 17,
				KBD_KEY_ALT: 18,
				KBD_KEY_PAUSE: 19,
				KBD_KEY_CAPS_LOCK: 20,
				KBD_KEY_ESCAPE: 27,
				KBD_KEY_SPACE: 32,
				KBD_KEY_PAGE_UP: 33,
				KBD_KEY_PAGE_DOWN: 34,
				KBD_KEY_END: 35,
				KBD_KEY_HOME: 36,
				KBD_KEY_LEFT: 37,
				KBD_KEY_UP: 38,
				KBD_KEY_RIGHT: 39,
				KBD_KEY_DOWN: 40,
				KBD_KEY_PRINTSCREEN: 44,
				KBD_KEY_INSERT: 45,
				KBD_KEY_DELETE: 46,
				KBD_KEY_0: 48,
				KBD_KEY_1: 49,
				KBD_KEY_2: 50,
				KBD_KEY_3: 51,
				KBD_KEY_4: 52,
				KBD_KEY_5: 53,
				KBD_KEY_6: 54,
				KBD_KEY_7: 55,
				KBD_KEY_8: 56,
				KBD_KEY_9: 57,
				KBD_KEY_SEMICOLON: 59,
				KBD_KEY_EQUALS: 61,
				KBD_KEY_A: 65,
				KBD_KEY_B: 66,
				KBD_KEY_C: 67,
				KBD_KEY_D: 68,
				KBD_KEY_E: 69,
				KBD_KEY_F: 70,
				KBD_KEY_G: 71,
				KBD_KEY_H: 72,
				KBD_KEY_I: 73,
				KBD_KEY_J: 74,
				KBD_KEY_K: 75,
				KBD_KEY_L: 76,
				KBD_KEY_M: 77,
				KBD_KEY_N: 78,
				KBD_KEY_O: 79,
				KBD_KEY_P: 80,
				KBD_KEY_Q: 81,
				KBD_KEY_R: 82,
				KBD_KEY_S: 83,
				KBD_KEY_T: 84,
				KBD_KEY_U: 85,
				KBD_KEY_V: 86,
				KBD_KEY_W: 87,
				KBD_KEY_X: 88,
				KBD_KEY_Y: 89,
				KBD_KEY_Z: 90,
				KBD_KEY_CONTEXT_MENU: 93,
				KBD_KEY_NUMPAD0: 96,
				KBD_KEY_NUMPAD1: 97,
				KBD_KEY_NUMPAD2: 98,
				KBD_KEY_NUMPAD3: 99,
				KBD_KEY_NUMPAD4: 100,
				KBD_KEY_NUMPAD5: 101,
				KBD_KEY_NUMPAD6: 102,
				KBD_KEY_NUMPAD7: 103,
				KBD_KEY_NUMPAD8: 104,
				KBD_KEY_NUMPAD9: 105,
				KBD_KEY_MULTIPLY: 106,
				KBD_KEY_DDD: 107,
				KBD_KEY_SEPARATOR: 108,
				KBD_KEY_SUBTRACT: 109,
				KBD_KEY_DECIMAL: 110,
				KBD_KEY_DIVIDE: 111,
				KBD_KEY_F1: 112,
				KBD_KEY_F2: 113,
				KBD_KEY_F3: 114,
				KBD_KEY_F4: 115,
				KBD_KEY_F5: 116,
				KBD_KEY_F6: 117,
				KBD_KEY_F7: 118,
				KBD_KEY_F8: 119,
				KBD_KEY_F9: 120,
				KBD_KEY_F10: 121,
				KBD_KEY_F11: 122,
				KBD_KEY_F12: 123,
				KBD_KEY_F13: 124,
				KBD_KEY_F14: 125,
				KBD_KEY_F15: 126,
				KBD_KEY_F16: 127,
				KBD_KEY_F17: 128,
				KBD_KEY_F18: 129,
				KBD_KEY_F19: 130,
				KBD_KEY_F20: 131,
				KBD_KEY_F21: 132,
				KBD_KEY_F22: 133,
				KBD_KEY_F23: 134,
				KBD_KEY_F24: 135,
				KBD_KEY_NUM_LOCK: 144,
				KBD_KEY_SCROLL_LOCK: 145,
				KBD_KEY_COMMA: 188,
				KBD_KEY_PERIOD: 190,
				KBD_KEY_SLASH: 191,
				KBD_KEY_BACK_QUOTE: 192,
				KBD_KEY_OPEN_BRACKET: 219,
				KBD_KEY_BACK_SLASH: 220,
				KBD_KEY_CLOSE_BRACKET: 221,
				KBD_KEY_QUOTE: 222,
				KBD_KEY_META: 224

			});

			constants$({
				GL_ACTIVE_ATTRIBUTES: 35721,
				GL_ACTIVE_TEXTURE: 34016,
				GL_ACTIVE_UNIFORMS: 35718,
				GL_ALIASED_LINE_WIDTH_RANGE: 33902,
				GL_ALIASED_POINT_SIZE_RANGE: 33901,
				GL_ALPHA: 6406,
				GL_ALPHA_BITS: 3413,
				GL_ALWAYS: 519,
				GL_ARRAY_BUFFER: 34962,
				GL_ARRAY_BUFFER_BINDING: 34964,
				GL_ATTACHED_SHADERS: 35717,
				GL_BACK: 1029,
				GL_BLEND: 3042,
				GL_BLEND_COLOR: 32773,
				GL_BLEND_DST_ALPHA: 32970,
				GL_BLEND_DST_RGB: 32968,
				GL_BLEND_EQUATION: 32777,
				GL_BLEND_EQUATION_ALPHA: 34877,
				GL_BLEND_EQUATION_RGB: 32777,
				GL_BLEND_SRC_ALPHA: 32971,
				GL_BLEND_SRC_RGB: 32969,
				GL_BLUE_BITS: 3412,
				GL_BOOL: 35670,
				GL_BOOL_VEC2: 35671,
				GL_BOOL_VEC3: 35672,
				GL_BOOL_VEC4: 35673,
				GL_BROWSER_DEFAULT_WEBGL: 37444,
				GL_BUFFER_SIZE: 34660,
				GL_BUFFER_USAGE: 34661,
				GL_BYTE: 5120,
				GL_CCW: 2305,
				GL_CLAMP_TO_EDGE: 33071,
				GL_COLOR_ATTACHMENT0: 36064,
				GL_COLOR_BUFFER_BIT: 16384,
				GL_COLOR_CLEAR_VALUE: 3106,
				GL_COLOR_WRITEMASK: 3107,
				GL_COMPILE_STATUS: 35713,
				GL_COMPRESSED_TEXTURE_FORMATS: 34467,
				GL_CONSTANT_ALPHA: 32771,
				GL_CONSTANT_COLOR: 32769,
				GL_CONTEXT_LOST_WEBGL: 37442,
				GL_CULL_FACE: 2884,
				GL_CULL_FACE_MODE: 2885,
				GL_CURRENT_PROGRAM: 35725,
				GL_CURRENT_VERTEX_ATTRIB: 34342,
				GL_CW: 2304,
				GL_DECR: 7683,
				GL_DECR_WRAP: 34056,
				GL_DELETE_STATUS: 35712,
				GL_DEPTH_ATTACHMENT: 36096,
				GL_DEPTH_BITS: 3414,
				GL_DEPTH_BUFFER_BIT: 256,
				GL_DEPTH_CLEAR_VALUE: 2931,
				GL_DEPTH_COMPONENT: 6402,
				GL_DEPTH_COMPONENT16: 33189,
				GL_DEPTH_FUNC: 2932,
				GL_DEPTH_RANGE: 2928,
				GL_DEPTH_STENCIL: 34041,
				GL_DEPTH_STENCIL_ATTACHMENT: 33306,
				GL_DEPTH_TEST: 2929,
				GL_DEPTH_WRITEMASK: 2930,
				GL_DITHER: 3024,
				GL_DONT_CARE: 4352,
				GL_DST_ALPHA: 772,
				GL_DST_COLOR: 774,
				GL_DYNAMIC_DRAW: 35048,
				GL_ELEMENT_ARRAY_BUFFER: 34963,
				GL_ELEMENT_ARRAY_BUFFER_BINDING: 34965,
				GL_EQUAL: 514,
				GL_FASTEST: 4353,
				GL_FLOAT: 5126,
				GL_FLOAT_MAT2: 35674,
				GL_FLOAT_MAT3: 35675,
				GL_FLOAT_MAT4: 35676,
				GL_FLOAT_VEC2: 35664,
				GL_FLOAT_VEC3: 35665,
				GL_FLOAT_VEC4: 35666,
				GL_FRAGMENT_SHADER: 35632,
				GL_FRAMEBUFFER: 36160,
				GL_FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 36049,
				GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 36048,
				GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 36051,
				GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 36050,
				GL_FRAMEBUFFER_BINDING: 36006,
				GL_FRAMEBUFFER_COMPLETE: 36053,
				GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 36054,
				GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 36057,
				GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 36055,
				GL_FRAMEBUFFER_UNSUPPORTED: 36061,
				GL_FRONT: 1028,
				GL_FRONT_AND_BACK: 1032,
				GL_FRONT_FACE: 2886,
				GL_FUNC_ADD: 32774,
				GL_FUNC_REVERSE_SUBTRACT: 32779,
				GL_FUNC_SUBTRACT: 32778,
				GL_GENERATE_MIPMAP_HINT: 33170,
				GL_GEQUAL: 518,
				GL_GREATER: 516,
				GL_GREEN_BITS: 3411,
				GL_HIGH_FLOAT: 36338,
				GL_HIGH_INT: 36341,
				GL_IMPLEMENTATION_COLOR_READ_FORMAT: 35739,
				GL_IMPLEMENTATION_COLOR_READ_TYPE: 35738,
				GL_INCR: 7682,
				GL_INCR_WRAP: 34055,
				GL_INT: 5124,
				GL_INT_VEC2: 35667,
				GL_INT_VEC3: 35668,
				GL_INT_VEC4: 35669,
				GL_INVALID_ENUM: 1280,
				GL_INVALID_FRAMEBUFFER_OPERATION: 1286,
				GL_INVALID_OPERATION: 1282,
				GL_INVALID_VALUE: 1281,
				GL_INVERT: 5386,
				GL_KEEP: 7680,
				GL_LEQUAL: 515,
				GL_LESS: 513,
				GL_LINEAR: 9729,
				GL_LINEAR_MIPMAP_LINEAR: 9987,
				GL_LINEAR_MIPMAP_NEAREST: 9985,
				GL_LINES: 1,
				GL_LINE_LOOP: 2,
				GL_LINE_STRIP: 3,
				GL_LINE_WIDTH: 2849,
				GL_LINK_STATUS: 35714,
				GL_LOW_FLOAT: 36336,
				GL_LOW_INT: 36339,
				GL_LUMINANCE: 6409,
				GL_LUMINANCE_ALPHA: 6410,
				GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
				GL_MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
				GL_MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
				GL_MAX_RENDERBUFFER_SIZE: 34024,
				GL_MAX_TEXTURE_IMAGE_UNITS: 34930,
				GL_MAX_TEXTURE_SIZE: 3379,
				GL_MAX_VARYING_VECTORS: 36348,
				GL_MAX_VERTEX_ATTRIBS: 34921,
				GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
				GL_MAX_VERTEX_UNIFORM_VECTORS: 36347,
				GL_MAX_VIEWPORT_DIMS: 3386,
				GL_MEDIUM_FLOAT: 36337,
				GL_MEDIUM_INT: 36340,
				GL_MIRRORED_REPEAT: 33648,
				GL_NEAREST: 9728,
				GL_NEAREST_MIPMAP_LINEAR: 9986,
				GL_NEAREST_MIPMAP_NEAREST: 9984,
				GL_NEVER: 512,
				GL_NICEST: 4354,
				GL_NONE: 0,
				GL_NOTEQUAL: 517,
				GL_NO_ERROR: 0,
				GL_ONE: 1,
				GL_ONE_MINUS_CONSTANT_ALPHA: 32772,
				GL_ONE_MINUS_CONSTANT_COLOR: 32770,
				GL_ONE_MINUS_DST_ALPHA: 773,
				GL_ONE_MINUS_DST_COLOR: 775,
				GL_ONE_MINUS_SRC_ALPHA: 771,
				GL_ONE_MINUS_SRC_COLOR: 769,
				GL_OUT_OF_MEMORY: 1285,
				GL_PACK_ALIGNMENT: 3333,
				GL_POINTS: 0,
				GL_POLYGON_OFFSET_FACTOR: 32824,
				GL_POLYGON_OFFSET_FILL: 32823,
				GL_POLYGON_OFFSET_UNITS: 10752,
				GL_RED_BITS: 3410,
				GL_RENDERBUFFER: 36161,
				GL_RENDERBUFFER_ALPHA_SIZE: 36179,
				GL_RENDERBUFFER_BINDING: 36007,
				GL_RENDERBUFFER_BLUE_SIZE: 36178,
				GL_RENDERBUFFER_DEPTH_SIZE: 36180,
				GL_RENDERBUFFER_GREEN_SIZE: 36177,
				GL_RENDERBUFFER_HEIGHT: 36163,
				GL_RENDERBUFFER_INTERNAL_FORMAT: 36164,
				GL_RENDERBUFFER_RED_SIZE: 36176,
				GL_RENDERBUFFER_STENCIL_SIZE: 36181,
				GL_RENDERBUFFER_WIDTH: 36162,
				GL_RENDERER: 7937,
				GL_REPEAT: 10497,
				GL_REPLACE: 7681,
				GL_RGB: 6407,
				GL_RGB5_A1: 32855,
				GL_RGB565: 36194,
				GL_RGBA: 6408,
				GL_RGBA4: 32854,
				GL_SAMPLER_2D: 35678,
				GL_SAMPLER_CUBE: 35680,
				GL_SAMPLES: 32937,
				GL_SAMPLE_ALPHA_TO_COVERAGE: 32926,
				GL_SAMPLE_BUFFERS: 32936,
				GL_SAMPLE_COVERAGE: 32928,
				GL_SAMPLE_COVERAGE_INVERT: 32939,
				GL_SAMPLE_COVERAGE_VALUE: 32938,
				GL_SCISSOR_BOX: 3088,
				GL_SCISSOR_TEST: 3089,
				GL_SHADER_TYPE: 35663,
				GL_SHADING_LANGUAGE_VERSION: 35724,
				GL_SHORT: 5122,
				GL_SRC_ALPHA: 770,
				GL_SRC_ALPHA_SATURATE: 776,
				GL_SRC_COLOR: 768,
				GL_STATIC_DRAW: 35044,
				GL_STENCIL_ATTACHMENT: 36128,
				GL_STENCIL_BACK_FAIL: 34817,
				GL_STENCIL_BACK_FUNC: 34816,
				GL_STENCIL_BACK_PASS_DEPTH_FAIL: 34818,
				GL_STENCIL_BACK_PASS_DEPTH_PASS: 34819,
				GL_STENCIL_BACK_REF: 36003,
				GL_STENCIL_BACK_VALUE_MASK: 36004,
				GL_STENCIL_BACK_WRITEMASK: 36005,
				GL_STENCIL_BITS: 3415,
				GL_STENCIL_BUFFER_BIT: 1024,
				GL_STENCIL_CLEAR_VALUE: 2961,
				GL_STENCIL_FAIL: 2964,
				GL_STENCIL_FUNC: 2962,
				GL_STENCIL_INDEX8: 36168,
				GL_STENCIL_PASS_DEPTH_FAIL: 2965,
				GL_STENCIL_PASS_DEPTH_PASS: 2966,
				GL_STENCIL_REF: 2967,
				GL_STENCIL_TEST: 2960,
				GL_STENCIL_VALUE_MASK: 2963,
				GL_STENCIL_WRITEMASK: 2968,
				GL_STREAM_DRAW: 35040,
				GL_SUBPIXEL_BITS: 3408,
				GL_TEXTURE: 5890,
				GL_TEXTURE0: 33984,
				GL_TEXTURE1: 33985,
				GL_TEXTURE2: 33986,
				GL_TEXTURE3: 33987,
				GL_TEXTURE4: 33988,
				GL_TEXTURE5: 33989,
				GL_TEXTURE6: 33990,
				GL_TEXTURE7: 33991,
				GL_TEXTURE8: 33992,
				GL_TEXTURE9: 33993,
				GL_TEXTURE10: 33994,
				GL_TEXTURE11: 33995,
				GL_TEXTURE12: 33996,
				GL_TEXTURE13: 33997,
				GL_TEXTURE14: 33998,
				GL_TEXTURE15: 33999,
				GL_TEXTURE16: 34000,
				GL_TEXTURE17: 34001,
				GL_TEXTURE18: 34002,
				GL_TEXTURE19: 34003,
				GL_TEXTURE20: 34004,
				GL_TEXTURE21: 34005,
				GL_TEXTURE22: 34006,
				GL_TEXTURE23: 34007,
				GL_TEXTURE24: 34008,
				GL_TEXTURE25: 34009,
				GL_TEXTURE26: 34010,
				GL_TEXTURE27: 34011,
				GL_TEXTURE28: 34012,
				GL_TEXTURE29: 34013,
				GL_TEXTURE30: 34014,
				GL_TEXTURE31: 34015,
				GL_TEXTURE_2D: 3553,
				GL_TEXTURE_BINDING_2D: 32873,
				GL_TEXTURE_BINDING_CUBE_MAP: 34068,
				GL_TEXTURE_CUBE_MAP: 34067,
				GL_TEXTURE_CUBE_MAP_NEGATIVE_X: 34070,
				GL_TEXTURE_CUBE_MAP_NEGATIVE_Y: 34072,
				GL_TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074,
				GL_TEXTURE_CUBE_MAP_POSITIVE_X: 34069,
				GL_TEXTURE_CUBE_MAP_POSITIVE_Y: 34071,
				GL_TEXTURE_CUBE_MAP_POSITIVE_Z: 34073,
				GL_TEXTURE_MAG_FILTER: 10240,
				GL_TEXTURE_MIN_FILTER: 10241,
				GL_TEXTURE_WRAP_S: 10242,
				GL_TEXTURE_WRAP_T: 10243,
				GL_TRIANGLES: 4,
				GL_TRIANGLE_FAN: 6,
				GL_TRIANGLE_STRIP: 5,
				GL_UNPACK_ALIGNMENT: 3317,
				GL_UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
				GL_UNPACK_FLIP_Y_WEBGL: 37440,
				GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
				GL_UNSIGNED_BYTE: 5121,
				GL_UNSIGNED_INT: 5125,
				GL_UNSIGNED_SHORT: 5123,
				GL_UNSIGNED_SHORT_4_4_4_4: 32819,
				GL_UNSIGNED_SHORT_5_5_5_1: 32820,
				GL_UNSIGNED_SHORT_5_6_5: 33635,
				GL_VALIDATE_STATUS: 35715,
				GL_VENDOR: 7936,
				GL_VERSION: 7938,
				GL_VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 34975,
				GL_VERTEX_ATTRIB_ARRAY_ENABLED: 34338,
				GL_VERTEX_ATTRIB_ARRAY_NORMALIZED: 34922,
				GL_VERTEX_ATTRIB_ARRAY_POINTER: 34373,
				GL_VERTEX_ATTRIB_ARRAY_SIZE: 34339,
				GL_VERTEX_ATTRIB_ARRAY_STRIDE: 34340,
				GL_VERTEX_ATTRIB_ARRAY_TYPE: 34341,
				GL_VERTEX_SHADER: 35633,
				GL_VIEWPORT: 2978,
				GL_ZERO: 0
			})

			constants$({
				GL_DEPTH_BUFFER_BIT: 256,
				GL_STENCIL_BUFFER_BIT: 1024,
				GL_COLOR_BUFFER_BIT: 16384,
				GL_POINTS: 0,
				GL_LINES: 1,
				GL_LINE_LOOP: 2,
				GL_LINE_STRIP: 3,
				GL_TRIANGLES: 4,
				GL_TRIANGLE_STRIP: 5,
				GL_TRIANGLE_FAN: 6,
				GL_ZERO: 0,
				GL_ONE: 1,
				GL_SRC_COLOR: 768,
				GL_ONE_MINUS_SRC_COLOR: 769,
				GL_SRC_ALPHA: 770,
				GL_ONE_MINUS_SRC_ALPHA: 771,
				GL_DST_ALPHA: 772,
				GL_ONE_MINUS_DST_ALPHA: 773,
				GL_DST_COLOR: 774,
				GL_ONE_MINUS_DST_COLOR: 775,
				GL_SRC_ALPHA_SATURATE: 776,
				GL_FUNC_ADD: 32774,
				GL_BLEND_EQUATION: 32777,
				GL_BLEND_EQUATION_RGB: 32777,
				GL_BLEND_EQUATION_ALPHA: 34877,
				GL_FUNC_SUBTRACT: 32778,
				GL_FUNC_REVERSE_SUBTRACT: 32779,
				GL_BLEND_DST_RGB: 32968,
				GL_BLEND_SRC_RGB: 32969,
				GL_BLEND_DST_ALPHA: 32970,
				GL_BLEND_SRC_ALPHA: 32971,
				GL_CONSTANT_COLOR: 32769,
				GL_ONE_MINUS_CONSTANT_COLOR: 32770,
				GL_CONSTANT_ALPHA: 32771,
				GL_ONE_MINUS_CONSTANT_ALPHA: 32772,
				GL_BLEND_COLOR: 32773,
				GL_ARRAY_BUFFER: 34962,
				GL_ELEMENT_ARRAY_BUFFER: 34963,
				GL_ARRAY_BUFFER_BINDING: 34964,
				GL_ELEMENT_ARRAY_BUFFER_BINDING: 34965,
				GL_STREAM_DRAW: 35040,
				GL_STATIC_DRAW: 35044,
				GL_DYNAMIC_DRAW: 35048,
				GL_BUFFER_SIZE: 34660,
				GL_BUFFER_USAGE: 34661,
				GL_CURRENT_VERTEX_ATTRIB: 34342,
				GL_FRONT: 1028,
				GL_BACK: 1029,
				GL_FRONT_AND_BACK: 1032,
				GL_TEXTURE_2D: 3553,
				GL_CULL_FACE: 2884,
				GL_BLEND: 3042,
				GL_DITHER: 3024,
				GL_STENCIL_TEST: 2960,
				GL_DEPTH_TEST: 2929,
				GL_SCISSOR_TEST: 3089,
				GL_POLYGON_OFFSET_FILL: 32823,
				GL_SAMPLE_ALPHA_TO_COVERAGE: 32926,
				GL_SAMPLE_COVERAGE: 32928,
				GL_NO_ERROR: 0,
				GL_INVALID_ENUM: 1280,
				GL_INVALID_VALUE: 1281,
				GL_INVALID_OPERATION: 1282,
				GL_OUT_OF_MEMORY: 1285,
				GL_CW: 2304,
				GL_CCW: 2305,
				GL_LINE_WIDTH: 2849,
				GL_ALIASED_POINT_SIZE_RANGE: 33901,
				GL_ALIASED_LINE_WIDTH_RANGE: 33902,
				GL_CULL_FACE_MODE: 2885,
				GL_FRONT_FACE: 2886,
				GL_DEPTH_RANGE: 2928,
				GL_DEPTH_WRITEMASK: 2930,
				GL_DEPTH_CLEAR_VALUE: 2931,
				GL_DEPTH_FUNC: 2932,
				GL_STENCIL_CLEAR_VALUE: 2961,
				GL_STENCIL_FUNC: 2962,
				GL_STENCIL_FAIL: 2964,
				GL_STENCIL_PASS_DEPTH_FAIL: 2965,
				GL_STENCIL_PASS_DEPTH_PASS: 2966,
				GL_STENCIL_REF: 2967,
				GL_STENCIL_VALUE_MASK: 2963,
				GL_STENCIL_WRITEMASK: 2968,
				GL_STENCIL_BACK_FUNC: 34816,
				GL_STENCIL_BACK_FAIL: 34817,
				GL_STENCIL_BACK_PASS_DEPTH_FAIL: 34818,
				GL_STENCIL_BACK_PASS_DEPTH_PASS: 34819,
				GL_STENCIL_BACK_REF: 36003,
				GL_STENCIL_BACK_VALUE_MASK: 36004,
				GL_STENCIL_BACK_WRITEMASK: 36005,
				GL_VIEWPORT: 2978,
				GL_SCISSOR_BOX: 3088,
				GL_COLOR_CLEAR_VALUE: 3106,
				GL_COLOR_WRITEMASK: 3107,
				GL_UNPACK_ALIGNMENT: 3317,
				GL_PACK_ALIGNMENT: 3333,
				GL_MAX_TEXTURE_SIZE: 3379,
				GL_MAX_VIEWPORT_DIMS: 3386,
				GL_SUBPIXEL_BITS: 3408,
				GL_RED_BITS: 3410,
				GL_GREEN_BITS: 3411,
				GL_BLUE_BITS: 3412,
				GL_ALPHA_BITS: 3413,
				GL_DEPTH_BITS: 3414,
				GL_STENCIL_BITS: 3415,
				GL_POLYGON_OFFSET_UNITS: 10752,
				GL_POLYGON_OFFSET_FACTOR: 32824,
				GL_TEXTURE_BINDING_2D: 32873,
				GL_SAMPLE_BUFFERS: 32936,
				GL_SAMPLES: 32937,
				GL_SAMPLE_COVERAGE_VALUE: 32938,
				GL_SAMPLE_COVERAGE_INVERT: 32939,
				GL_COMPRESSED_TEXTURE_FORMATS: 34467,
				GL_DONT_CARE: 4352,
				GL_FASTEST: 4353,
				GL_NICEST: 4354,
				GL_GENERATE_MIPMAP_HINT: 33170,
				GL_BYTE: 5120,
				GL_UNSIGNED_BYTE: 5121,
				GL_SHORT: 5122,
				GL_UNSIGNED_SHORT: 5123,
				GL_INT: 5124,
				GL_UNSIGNED_INT: 5125,
				GL_FLOAT: 5126,
				GL_DEPTH_COMPONENT: 6402,
				GL_ALPHA: 6406,
				GL_RGB: 6407,
				GL_RGBA: 6408,
				GL_LUMINANCE: 6409,
				GL_LUMINANCE_ALPHA: 6410,
				GL_UNSIGNED_SHORT_4_4_4_4: 32819,
				GL_UNSIGNED_SHORT_5_5_5_1: 32820,
				GL_UNSIGNED_SHORT_5_6_5: 33635,
				GL_FRAGMENT_SHADER: 35632,
				GL_VERTEX_SHADER: 35633,
				GL_MAX_VERTEX_ATTRIBS: 34921,
				GL_MAX_VERTEX_UNIFORM_VECTORS: 36347,
				GL_MAX_VARYING_VECTORS: 36348,
				GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
				GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
				GL_MAX_TEXTURE_IMAGE_UNITS: 34930,
				GL_MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
				GL_SHADER_TYPE: 35663,
				GL_DELETE_STATUS: 35712,
				GL_LINK_STATUS: 35714,
				GL_VALIDATE_STATUS: 35715,
				GL_ATTACHED_SHADERS: 35717,
				GL_ACTIVE_UNIFORMS: 35718,
				GL_ACTIVE_ATTRIBUTES: 35721,
				GL_SHADING_LANGUAGE_VERSION: 35724,
				GL_CURRENT_PROGRAM: 35725,
				GL_NEVER: 512,
				GL_LESS: 513,
				GL_EQUAL: 514,
				GL_LEQUAL: 515,
				GL_GREATER: 516,
				GL_NOTEQUAL: 517,
				GL_GEQUAL: 518,
				GL_ALWAYS: 519,
				GL_KEEP: 7680,
				GL_REPLACE: 7681,
				GL_INCR: 7682,
				GL_DECR: 7683,
				GL_INVERT: 5386,
				GL_INCR_WRAP: 34055,
				GL_DECR_WRAP: 34056,
				GL_VENDOR: 7936,
				GL_RENDERER: 7937,
				GL_VERSION: 7938,
				GL_NEAREST: 9728,
				GL_LINEAR: 9729,
				GL_NEAREST_MIPMAP_NEAREST: 9984,
				GL_LINEAR_MIPMAP_NEAREST: 9985,
				GL_NEAREST_MIPMAP_LINEAR: 9986,
				GL_LINEAR_MIPMAP_LINEAR: 9987,
				GL_TEXTURE_MAG_FILTER: 10240,
				GL_TEXTURE_MIN_FILTER: 10241,
				GL_TEXTURE_WRAP_S: 10242,
				GL_TEXTURE_WRAP_T: 10243,
				GL_TEXTURE: 5890,
				GL_TEXTURE_CUBE_MAP: 34067,
				GL_TEXTURE_BINDING_CUBE_MAP: 34068,
				GL_TEXTURE_CUBE_MAP_POSITIVE_X: 34069,
				GL_TEXTURE_CUBE_MAP_NEGATIVE_X: 34070,
				GL_TEXTURE_CUBE_MAP_POSITIVE_Y: 34071,
				GL_TEXTURE_CUBE_MAP_NEGATIVE_Y: 34072,
				GL_TEXTURE_CUBE_MAP_POSITIVE_Z: 34073,
				GL_TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074,
				GL_MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
				GL_TEXTURE0: 33984,
				GL_TEXTURE1: 33985,
				GL_TEXTURE2: 33986,
				GL_TEXTURE3: 33987,
				GL_TEXTURE4: 33988,
				GL_TEXTURE5: 33989,
				GL_TEXTURE6: 33990,
				GL_TEXTURE7: 33991,
				GL_TEXTURE8: 33992,
				GL_TEXTURE9: 33993,
				GL_TEXTURE10: 33994,
				GL_TEXTURE11: 33995,
				GL_TEXTURE12: 33996,
				GL_TEXTURE13: 33997,
				GL_TEXTURE14: 33998,
				GL_TEXTURE15: 33999,
				GL_TEXTURE16: 34000,
				GL_TEXTURE17: 34001,
				GL_TEXTURE18: 34002,
				GL_TEXTURE19: 34003,
				GL_TEXTURE20: 34004,
				GL_TEXTURE21: 34005,
				GL_TEXTURE22: 34006,
				GL_TEXTURE23: 34007,
				GL_TEXTURE24: 34008,
				GL_TEXTURE25: 34009,
				GL_TEXTURE26: 34010,
				GL_TEXTURE27: 34011,
				GL_TEXTURE28: 34012,
				GL_TEXTURE29: 34013,
				GL_TEXTURE30: 34014,
				GL_TEXTURE31: 34015,
				GL_ACTIVE_TEXTURE: 34016,
				GL_REPEAT: 10497,
				GL_CLAMP_TO_EDGE: 33071,
				GL_MIRRORED_REPEAT: 33648,
				GL_FLOAT_VEC2: 35664,
				GL_FLOAT_VEC3: 35665,
				GL_FLOAT_VEC4: 35666,
				GL_INT_VEC2: 35667,
				GL_INT_VEC3: 35668,
				GL_INT_VEC4: 35669,
				GL_BOOL: 35670,
				GL_BOOL_VEC2: 35671,
				GL_BOOL_VEC3: 35672,
				GL_BOOL_VEC4: 35673,
				GL_FLOAT_MAT2: 35674,
				GL_FLOAT_MAT3: 35675,
				GL_FLOAT_MAT4: 35676,
				GL_SAMPLER_2D: 35678,
				GL_SAMPLER_CUBE: 35680,
				GL_VERTEX_ATTRIB_ARRAY_ENABLED: 34338,
				GL_VERTEX_ATTRIB_ARRAY_SIZE: 34339,
				GL_VERTEX_ATTRIB_ARRAY_STRIDE: 34340,
				GL_VERTEX_ATTRIB_ARRAY_TYPE: 34341,
				GL_VERTEX_ATTRIB_ARRAY_NORMALIZED: 34922,
				GL_VERTEX_ATTRIB_ARRAY_POINTER: 34373,
				GL_VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 34975,
				GL_IMPLEMENTATION_COLOR_READ_TYPE: 35738,
				GL_IMPLEMENTATION_COLOR_READ_FORMAT: 35739,
				GL_COMPILE_STATUS: 35713,
				GL_LOW_FLOAT: 36336,
				GL_MEDIUM_FLOAT: 36337,
				GL_HIGH_FLOAT: 36338,
				GL_LOW_INT: 36339,
				GL_MEDIUM_INT: 36340,
				GL_HIGH_INT: 36341,
				GL_FRAMEBUFFER: 36160,
				GL_RENDERBUFFER: 36161,
				GL_RGBA4: 32854,
				GL_RGB5_A1: 32855,
				GL_RGB565: 36194,
				GL_DEPTH_COMPONENT16: 33189,
				GL_STENCIL_INDEX8: 36168,
				GL_DEPTH_STENCIL: 34041,
				GL_RENDERBUFFER_WIDTH: 36162,
				GL_RENDERBUFFER_HEIGHT: 36163,
				GL_RENDERBUFFER_INTERNAL_FORMAT: 36164,
				GL_RENDERBUFFER_RED_SIZE: 36176,
				GL_RENDERBUFFER_GREEN_SIZE: 36177,
				GL_RENDERBUFFER_BLUE_SIZE: 36178,
				GL_RENDERBUFFER_ALPHA_SIZE: 36179,
				GL_RENDERBUFFER_DEPTH_SIZE: 36180,
				GL_RENDERBUFFER_STENCIL_SIZE: 36181,
				GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 36048,
				GL_FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 36049,
				GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 36050,
				GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 36051,
				GL_COLOR_ATTACHMENT0: 36064,
				GL_DEPTH_ATTACHMENT: 36096,
				GL_STENCIL_ATTACHMENT: 36128,
				GL_DEPTH_STENCIL_ATTACHMENT: 33306,
				GL_NONE: 0,
				GL_FRAMEBUFFER_COMPLETE: 36053,
				GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 36054,
				GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 36055,
				GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 36057,
				GL_FRAMEBUFFER_UNSUPPORTED: 36061,
				GL_FRAMEBUFFER_BINDING: 36006,
				GL_RENDERBUFFER_BINDING: 36007,
				GL_MAX_RENDERBUFFER_SIZE: 34024,
				GL_INVALID_FRAMEBUFFER_OPERATION: 1286,
				GL_UNPACK_FLIP_Y_WEBGL: 37440,
				GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
				GL_CONTEXT_LOST_WEBGL: 37442,
				GL_UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
				GL_BROWSER_DEFAULT_WEBGL: 37444,
				GL_READ_BUFFER: 3074,
				GL_UNPACK_ROW_LENGTH: 3314,
				GL_UNPACK_SKIP_ROWS: 3315,
				GL_UNPACK_SKIP_PIXELS: 3316,
				GL_PACK_ROW_LENGTH: 3330,
				GL_PACK_SKIP_ROWS: 3331,
				GL_PACK_SKIP_PIXELS: 3332,
				GL_COLOR: 6144,
				GL_DEPTH: 6145,
				GL_STENCIL: 6146,
				GL_RED: 6403,
				GL_RGB8: 32849,
				GL_RGBA8: 32856,
				GL_RGB10_A2: 32857,
				GL_TEXTURE_BINDING_3D: 32874,
				GL_UNPACK_SKIP_IMAGES: 32877,
				GL_UNPACK_IMAGE_HEIGHT: 32878,
				GL_TEXTURE_3D: 32879,
				GL_TEXTURE_WRAP_R: 32882,
				GL_MAX_3D_TEXTURE_SIZE: 32883,
				GL_UNSIGNED_INT_2_10_10_10_REV: 33640,
				GL_MAX_ELEMENTS_VERTICES: 33000,
				GL_MAX_ELEMENTS_INDICES: 33001,
				GL_TEXTURE_MIN_LOD: 33082,
				GL_TEXTURE_MAX_LOD: 33083,
				GL_TEXTURE_BASE_LEVEL: 33084,
				GL_TEXTURE_MAX_LEVEL: 33085,
				GL_MIN: 32775,
				GL_MAX: 32776,
				GL_DEPTH_COMPONENT24: 33190,
				GL_MAX_TEXTURE_LOD_BIAS: 34045,
				GL_TEXTURE_COMPARE_MODE: 34892,
				GL_TEXTURE_COMPARE_FUNC: 34893,
				GL_CURRENT_QUERY: 34917,
				GL_QUERY_RESULT: 34918,
				GL_QUERY_RESULT_AVAILABLE: 34919,
				GL_STREAM_READ: 35041,
				GL_STREAM_COPY: 35042,
				GL_STATIC_READ: 35045,
				GL_STATIC_COPY: 35046,
				GL_DYNAMIC_READ: 35049,
				GL_DYNAMIC_COPY: 35050,
				GL_MAX_DRAW_BUFFERS: 34852,
				GL_DRAW_BUFFER0: 34853,
				GL_DRAW_BUFFER1: 34854,
				GL_DRAW_BUFFER2: 34855,
				GL_DRAW_BUFFER3: 34856,
				GL_DRAW_BUFFER4: 34857,
				GL_DRAW_BUFFER5: 34858,
				GL_DRAW_BUFFER6: 34859,
				GL_DRAW_BUFFER7: 34860,
				GL_DRAW_BUFFER8: 34861,
				GL_DRAW_BUFFER9: 34862,
				GL_DRAW_BUFFER10: 34863,
				GL_DRAW_BUFFER11: 34864,
				GL_DRAW_BUFFER12: 34865,
				GL_DRAW_BUFFER13: 34866,
				GL_DRAW_BUFFER14: 34867,
				GL_DRAW_BUFFER15: 34868,
				GL_MAX_FRAGMENT_UNIFORM_COMPONENTS: 35657,
				GL_MAX_VERTEX_UNIFORM_COMPONENTS: 35658,
				GL_SAMPLER_3D: 35679,
				GL_SAMPLER_2D_SHADOW: 35682,
				GL_FRAGMENT_SHADER_DERIVATIVE_HINT: 35723,
				GL_PIXEL_PACK_BUFFER: 35051,
				GL_PIXEL_UNPACK_BUFFER: 35052,
				GL_PIXEL_PACK_BUFFER_BINDING: 35053,
				GL_PIXEL_UNPACK_BUFFER_BINDING: 35055,
				GL_FLOAT_MAT2x3: 35685,
				GL_FLOAT_MAT2x4: 35686,
				GL_FLOAT_MAT3x2: 35687,
				GL_FLOAT_MAT3x4: 35688,
				GL_FLOAT_MAT4x2: 35689,
				GL_FLOAT_MAT4x3: 35690,
				GL_SRGB: 35904,
				GL_SRGB8: 35905,
				GL_SRGB8_ALPHA8: 35907,
				GL_COMPARE_REF_TO_TEXTURE: 34894,
				GL_RGBA32F: 34836,
				GL_RGB32F: 34837,
				GL_RGBA16F: 34842,
				GL_RGB16F: 34843,
				GL_VERTEX_ATTRIB_ARRAY_INTEGER: 35069,
				GL_MAX_ARRAY_TEXTURE_LAYERS: 35071,
				GL_MIN_PROGRAM_TEXEL_OFFSET: 35076,
				GL_MAX_PROGRAM_TEXEL_OFFSET: 35077,
				GL_MAX_VARYING_COMPONENTS: 35659,
				GL_TEXTURE_2D_ARRAY: 35866,
				GL_TEXTURE_BINDING_2D_ARRAY: 35869,
				GL_R11F_G11F_B10F: 35898,
				GL_UNSIGNED_INT_10F_11F_11F_REV: 35899,
				GL_RGB9_E5: 35901,
				GL_UNSIGNED_INT_5_9_9_9_REV: 35902,
				GL_TRANSFORM_FEEDBACK_BUFFER_MODE: 35967,
				GL_MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: 35968,
				GL_TRANSFORM_FEEDBACK_VARYINGS: 35971,
				GL_TRANSFORM_FEEDBACK_BUFFER_START: 35972,
				GL_TRANSFORM_FEEDBACK_BUFFER_SIZE: 35973,
				GL_TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN: 35976,
				GL_RASTERIZER_DISCARD: 35977,
				GL_MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: 35978,
				GL_MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: 35979,
				GL_INTERLEAVED_ATTRIBS: 35980,
				GL_SEPARATE_ATTRIBS: 35981,
				GL_TRANSFORM_FEEDBACK_BUFFER: 35982,
				GL_TRANSFORM_FEEDBACK_BUFFER_BINDING: 35983,
				GL_RGBA32UI: 36208,
				GL_RGB32UI: 36209,
				GL_RGBA16UI: 36214,
				GL_RGB16UI: 36215,
				GL_RGBA8UI: 36220,
				GL_RGB8UI: 36221,
				GL_RGBA32I: 36226,
				GL_RGB32I: 36227,
				GL_RGBA16I: 36232,
				GL_RGB16I: 36233,
				GL_RGBA8I: 36238,
				GL_RGB8I: 36239,
				GL_RED_INTEGER: 36244,
				GL_RGB_INTEGER: 36248,
				GL_RGBA_INTEGER: 36249,
				GL_SAMPLER_2D_ARRAY: 36289,
				GL_SAMPLER_2D_ARRAY_SHADOW: 36292,
				GL_SAMPLER_CUBE_SHADOW: 36293,
				GL_UNSIGNED_INT_VEC2: 36294,
				GL_UNSIGNED_INT_VEC3: 36295,
				GL_UNSIGNED_INT_VEC4: 36296,
				GL_INT_SAMPLER_2D: 36298,
				GL_INT_SAMPLER_3D: 36299,
				GL_INT_SAMPLER_CUBE: 36300,
				GL_INT_SAMPLER_2D_ARRAY: 36303,
				GL_UNSIGNED_INT_SAMPLER_2D: 36306,
				GL_UNSIGNED_INT_SAMPLER_3D: 36307,
				GL_UNSIGNED_INT_SAMPLER_CUBE: 36308,
				GL_UNSIGNED_INT_SAMPLER_2D_ARRAY: 36311,
				GL_DEPTH_COMPONENT32F: 36012,
				GL_DEPTH32F_STENCIL8: 36013,
				GL_FLOAT_32_UNSIGNED_INT_24_8_REV: 36269,
				GL_FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING: 33296,
				GL_FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: 33297,
				GL_FRAMEBUFFER_ATTACHMENT_RED_SIZE: 33298,
				GL_FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: 33299,
				GL_FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: 33300,
				GL_FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: 33301,
				GL_FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE: 33302,
				GL_FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE: 33303,
				GL_FRAMEBUFFER_DEFAULT: 33304,
				GL_UNSIGNED_INT_24_8: 34042,
				GL_DEPTH24_STENCIL8: 35056,
				GL_UNSIGNED_NORMALIZED: 35863,
				GL_DRAW_FRAMEBUFFER_BINDING: 36006,
				GL_READ_FRAMEBUFFER: 36008,
				GL_DRAW_FRAMEBUFFER: 36009,
				GL_READ_FRAMEBUFFER_BINDING: 36010,
				GL_RENDERBUFFER_SAMPLES: 36011,
				GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: 36052,
				GL_MAX_COLOR_ATTACHMENTS: 36063,
				GL_COLOR_ATTACHMENT1: 36065,
				GL_COLOR_ATTACHMENT2: 36066,
				GL_COLOR_ATTACHMENT3: 36067,
				GL_COLOR_ATTACHMENT4: 36068,
				GL_COLOR_ATTACHMENT5: 36069,
				GL_COLOR_ATTACHMENT6: 36070,
				GL_COLOR_ATTACHMENT7: 36071,
				GL_COLOR_ATTACHMENT8: 36072,
				GL_COLOR_ATTACHMENT9: 36073,
				GL_COLOR_ATTACHMENT10: 36074,
				GL_COLOR_ATTACHMENT11: 36075,
				GL_COLOR_ATTACHMENT12: 36076,
				GL_COLOR_ATTACHMENT13: 36077,
				GL_COLOR_ATTACHMENT14: 36078,
				GL_COLOR_ATTACHMENT15: 36079,
				GL_FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: 36182,
				GL_MAX_SAMPLES: 36183,
				GL_HALF_FLOAT: 5131,
				GL_RG: 33319,
				GL_RG_INTEGER: 33320,
				GL_R8: 33321,
				GL_RG8: 33323,
				GL_R16F: 33325,
				GL_R32F: 33326,
				GL_RG16F: 33327,
				GL_RG32F: 33328,
				GL_R8I: 33329,
				GL_R8UI: 33330,
				GL_R16I: 33331,
				GL_R16UI: 33332,
				GL_R32I: 33333,
				GL_R32UI: 33334,
				GL_RG8I: 33335,
				GL_RG8UI: 33336,
				GL_RG16I: 33337,
				GL_RG16UI: 33338,
				GL_RG32I: 33339,
				GL_RG32UI: 33340,
				GL_VERTEX_ARRAY_BINDING: 34229,
				GL_R8_SNORM: 36756,
				GL_RG8_SNORM: 36757,
				GL_RGB8_SNORM: 36758,
				GL_RGBA8_SNORM: 36759,
				GL_SIGNED_NORMALIZED: 36764,
				GL_COPY_READ_BUFFER: 36662,
				GL_COPY_WRITE_BUFFER: 36663,
				GL_COPY_READ_BUFFER_BINDING: 36662,
				GL_COPY_WRITE_BUFFER_BINDING: 36663,
				GL_UNIFORM_BUFFER: 35345,
				GL_UNIFORM_BUFFER_BINDING: 35368,
				GL_UNIFORM_BUFFER_START: 35369,
				GL_UNIFORM_BUFFER_SIZE: 35370,
				GL_MAX_VERTEX_UNIFORM_BLOCKS: 35371,
				GL_MAX_FRAGMENT_UNIFORM_BLOCKS: 35373,
				GL_MAX_COMBINED_UNIFORM_BLOCKS: 35374,
				GL_MAX_UNIFORM_BUFFER_BINDINGS: 35375,
				GL_MAX_UNIFORM_BLOCK_SIZE: 35376,
				GL_MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: 35377,
				GL_MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: 35379,
				GL_UNIFORM_BUFFER_OFFSET_ALIGNMENT: 35380,
				GL_ACTIVE_UNIFORM_BLOCKS: 35382,
				GL_UNIFORM_TYPE: 35383,
				GL_UNIFORM_SIZE: 35384,
				GL_UNIFORM_BLOCK_INDEX: 35386,
				GL_UNIFORM_OFFSET: 35387,
				GL_UNIFORM_ARRAY_STRIDE: 35388,
				GL_UNIFORM_MATRIX_STRIDE: 35389,
				GL_UNIFORM_IS_ROW_MAJOR: 35390,
				GL_UNIFORM_BLOCK_BINDING: 35391,
				GL_UNIFORM_BLOCK_DATA_SIZE: 35392,
				GL_UNIFORM_BLOCK_ACTIVE_UNIFORMS: 35394,
				GL_UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: 35395,
				GL_UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: 35396,
				GL_UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: 35398,
				GL_INVALID_INDEX: 4294967295,
				GL_MAX_VERTEX_OUTPUT_COMPONENTS: 37154,
				GL_MAX_FRAGMENT_INPUT_COMPONENTS: 37157,
				GL_MAX_SERVER_WAIT_TIMEOUT: 37137,
				GL_OBJECT_TYPE: 37138,
				GL_SYNC_CONDITION: 37139,
				GL_SYNC_STATUS: 37140,
				GL_SYNC_FLAGS: 37141,
				GL_SYNC_FENCE: 37142,
				GL_SYNC_GPU_COMMANDS_COMPLETE: 37143,
				GL_UNSIGNALED: 37144,
				GL_SIGNALED: 37145,
				GL_ALREADY_SIGNALED: 37146,
				GL_TIMEOUT_EXPIRED: 37147,
				GL_CONDITION_SATISFIED: 37148,
				GL_WAIT_FAILED: 37149,
				GL_SYNC_FLUSH_COMMANDS_BIT: 1,
				GL_VERTEX_ATTRIB_ARRAY_DIVISOR: 35070,
				GL_ANY_SAMPLES_PASSED: 35887,
				GL_ANY_SAMPLES_PASSED_CONSERVATIVE: 36202,
				GL_SAMPLER_BINDING: 35097,
				GL_RGB10_A2UI: 36975,
				GL_INT_2_10_10_10_REV: 36255,
				GL_TRANSFORM_FEEDBACK: 36386,
				GL_TRANSFORM_FEEDBACK_PAUSED: 36387,
				GL_TRANSFORM_FEEDBACK_ACTIVE: 36388,
				GL_TRANSFORM_FEEDBACK_BINDING: 36389,
				GL_TEXTURE_IMMUTABLE_FORMAT: 37167,
				GL_MAX_ELEMENT_INDEX: 36203,
				GL_TEXTURE_IMMUTABLE_LEVELS: 33503,
				GL_TIMEOUT_IGNORED: -1,
				GL_MAX_CLIENT_WAIT_TIMEOUT_WEBGL: 37447
			})




			function webgl2_context(def) {
				def = def || {};
				let _canvas = def.canvas;
				if (!_canvas) {
					_canvas = document.createElement("canvas");
					_canvas.setAttribute("style", "position:absolute;left:0;top:0;width:calc(100%);height:calc(100%)");
				}
				def.screen_scale = def.screen_scale || 1;
				def.canvas = _canvas;
				//def.desynchronized = def.desynchronized || true;
				def.alpha = def.alpha || !true;
				def.depth = def.depth || true;
				def.stencil = def.stencil || true;
				def.antialias = def.antialias || false;
				def.premultipliedAlpha = def.premultipliedAlpha || false;
				def.preserveDrawingBuffer = def.preserveDrawingBuffer || true;
				def.xrCompatible = def.xrCompatible || false;

				let gl = def.context || _canvas.getContext('webgl2', def);

				this.available_extensions = gl.getSupportedExtensions();
				gl.getExtension("EXT_color_buffer_float");
				gl.getExtension("OES_texture_float_linear");
				gl.getExtension("EXT_texture_filter_anisotropic");

				def.pixel_ratio = def.pixel_ratio || window.devicePixelRatio;

				_canvas.addEventListener('webglcontextlost', function () {
					console.log('webglcontextlost', this);
				}, false);

				_canvas.addEventListener('webglcontextrestored', function () {
					console.log('webglcontextrestored', this);
				}, false);

				gl.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
				gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
				gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);

				gl.clearColor(0, 0, 0, 0);
				const canvas_resized = new CustomEvent("canvas_resized", {});
				const observer = new ResizeObserver(function (entries) {
					const entry = entries[0];

					// entry.devicePixelContentBoxSize is an array
					const width = entry.devicePixelContentBoxSize[0].inlineSize;
					const height = entry.devicePixelContentBoxSize[0].blockSize;

					_canvas.width = width * def.screen_scale;
					_canvas.height = height * def.screen_scale;
					gl.resized = true;
					_canvas.dispatchEvent(canvas_resized);
				});
				def.gl = gl;
				observer.observe(_canvas);

				return def;
			}


			return webgl2_context;


		});
	});

	packing.register("object_stack", function () {

		packing("stack")("object_stack", function (stack) {


			function object_stack(apply) {
				const _stack = new stack();

				const s = {
					_stack: _stack,
					current: null,
					push: push,
					pop: pop
				};
				function push(item) {
					if (s.current) _stack.push(s.current);
					s.current = item;
					apply(item);
					return s.current;
				}

				function pop() {
					s.current = _stack.pop();
					apply(s.current);
					return s.current;
				}

				return s;

			}

			return object_stack;



		});
	});

	packing.register("hash_str", function () {

		packing()("hash_str", function () {

			function hash_str(str) {
				var hash = 2166136261;
				for (var i = 0; i < str.length; i++) {
					hash ^= str.charCodeAt(i);
					hash = Math.imul(hash, 16777619);
				}
				return hash >>> 0;
			}

			return hash_str;



		});
	});

	packing.register("query_string", function () {

		packing()("query_string", function () {



			const query_string = {
				parse: function (query) {
					var params = {};
					query = (query || "").replace(/^\?/, '');

					if (!query) return params;

					var pairs = query.split('&');
					var i, pair, key, value;

					for (i = 0; i < pairs.length; i++) {
						pair = pairs[i].split('=');
						key = decodeURIComponent(pair[0]);
						value = pair.length > 1 ? decodeURIComponent(pair[1]) : '';

						// Parse the value
						value = this.parse_value(value);

						// Handle duplicate keys
						if (params.hasOwnProperty(key)) {
							if (Array.isArray(params[key])) {
								params[key].push(value);
							} else {
								params[key] = [params[key], value];
							}
						} else {
							params[key] = value;
						}
					}

					return params;
				},

				parse_value: function (value) {
					// Convert boolean strings
					var lower = value.toLowerCase();
					if (lower === 'true') return true;
					if (lower === 'false') return false;

					// Convert numeric strings
					if (value !== '' && !isNaN(value)) {
						return Number(value);
					}

					// Return as string
					return value;
				},

				get: function (key, query) {
					var params = this.parse(query);
					return params.hasOwnProperty(key) ? params[key] : null;
				},

				stringify: function (params) {
					var parts = [];
					for (var key in params) {
						if (params.hasOwnProperty(key)) {
							var value = params[key];
							if (Array.isArray(value)) {
								for (var i = 0; i < value.length; i++) {
									parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value[i]));
								}
							} else {
								parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
							}
						}
					}
					return parts.join('&');
				}
			};

			return query_string;



		});
	});

	packing.register("str_uint8", function () {
		packing()("str_uint8", function () {
			const str_uint8 = function (str, pad, buff, offset) {
				pad = pad || 0;
				let arr;
				if (ArrayBuffer.isView(buff)) {
					arr = buff;
				}
				else {
					if (buff) {
						if (pad > 0) {
							arr = new Uint8Array(buff, offset || 0, (str.length + (pad - (str.length % pad))));
						}
						else {
							arr = new Uint8Array(buff, offset || 0, str.length);
						}
					}
					else {
						if (pad > 0) {
							arr = new Uint8Array((str.length + (pad - (str.length % pad))));
						}
						else {
							arr = new Uint8Array(str.length);
						}
					}
				}

				//arr.fill(0);
				for (let i = 0; i < str.length; i++) {
					arr[i] = str.charCodeAt(i);
				}
				return arr;
			};
			return str_uint8;
		});
	});

	packing.register("uint8_str", function () {
		packing()("uint8_str", function () {
			const uint8_str = function (arr) {
				let m = "";
				for (let i = 0; i < arr.length; i++) {
					m += String.fromCharCode(arr[i]);
				}
				return m;
			};

			return uint8_str;

		});
	});


	packing.register("events", function () {

		packing("define")("events", function (define) {



			this.event = define(function (proto) {
				let i = 0, ret;
				proto.add = function (cb, callee) {
					callee = callee || this.owner;
					this.handlers[this.handlers.length] = [cb, callee];
					return callee;
				};
				proto.trigger = function (params) {
					if (this.handlers.length > 0) {
						for (i = 0; i < this.handlers.length; i++)
							if (this.handlers[i][0].apply(this.handlers[i][1], params) === false) return false;
					}

				};


				proto.trigger_params = function () {
					if (this.handlers.length > 0) {
						for (i = 0; i < this.handlers.length; i++)
							if (this.handlers[i][0].apply(this.handlers[i][1], this.params) === false) return false;
					}

				};



				return function event(owner, params) {
					this.owner = owner;
					this.handlers = [];
					this.params = params;
				};
			});


			return this;

		});
	});


	packing.register("create_worker", function () {

		packing()("create_worker", function () {
			function fake(src) {
				const base = this;
				base.remote = {};
				let initial_post_msg;
				base.postMessage = function (mm) {
					initial_post_msg = mm;
					console.log("base.postMessage", mm);
				};

				const xtp = new XMLHttpRequest();

				xtp.onload = function () {
					let call_now;
					const self = base.remote;

					const m = {};
					function pass_base_msg() {
						console.log("pass_base_msg", m.data);
						base.onmessage(m);
					}

					function pass_self_msg() {
						console.log("pass_self_msg", m.data);
						self.onmessage(m);
					}

					self.postMessage = function (mm) {
						if (Array.isArray(mm)) {
							m.data = mm;
							//base.onmessage(m);
							//call_now.push(base);
							call_now = base;

						}
						else {
							m.data = mm;
							//base.onmessage(m);
							//call_now.push(base);
							call_now = base;
							//	base.onmessage({ data: JSON.parse(JSON.stringify(mm))});
						}


						//requestAnimationFrame(pass_base_msg);
					};

					base.postMessage = function (mm) {

						if (Array.isArray(mm)) {

							m.data = mm;
							//self.onmessage(m);
							call_now = self;
							//call_now.push(self);



						}
						else {
							m.data = mm;
							call_now = self;
							//call_now.push(self);

							//self.onmessage(m);
							//self.onmessage({ data: JSON.parse(JSON.stringify(mm)) });
						}
						//self.onmessage(m);
						//requestAnimationFrame(pass_self_msg);
					};


					//console.log(this.response);
					const func = new Function("self", this.response);
					func(self);
					if (initial_post_msg) {

						m.data = initial_post_msg;
						initial_post_msg = null;
						//self.onmessage(m);
					}
					this.abort();
					setInterval(function () {
						if (call_now) {
							call_now.onmessage(m);
						}
						return;
						if (call_now.length > 0) {
							call_now.shift().onmessage(m);
						}
					}, 20);
				};
				xtp.onerror = function () {
					console.log("onerror", this.response);
				};
				xtp.responseType = "text";
				xtp.open("GET", src, true);
				xtp.send();
			}

			function create_worker(func, use_fake) {
				let wsource = "";
				if (Object.prototype.toString.call(func) === "[object String]") {
					wsource = func;
				}
				else {
					wsource = func.toString();
				}
				let W = Worker;
				if (use_fake) W = fake;
				const wrk = new W(URL.createObjectURL(new Blob(['(' + wsource + ')(self);'])));
				return wrk;

			}


			return create_worker;



		});
	});


	packing.register("timer", function () {

		packing()("timer", function () {
			return function (cb, req_time_delta) {

				req_time_delta = req_time_delta || (1 / 60);
				let timer, current_time_delta, last_timer = 0, fps_timer = 0, fps_counter = 0, fps = 0;
				let _requestAnimationFrame;
				if (typeof window == "undefined") {
					_requestAnimationFrame = function (cb) {
						setTimeout(cb, req_time_delta * 1000);
					}
				} else {
					_requestAnimationFrame = requestAnimationFrame;

				}

				function call() {
					timer = performance.now() * 0.001;

					current_time_delta = timer - last_timer;

					if (current_time_delta < req_time_delta) {
						return;
					}

					current_time_delta = Math.max(req_time_delta, current_time_delta);



					cb(timer, current_time_delta, fps);
					last_timer = timer - (current_time_delta % req_time_delta);


					if (timer - fps_timer >= 1) {
						fps = fps_counter;
						fps_timer = timer;
						fps_counter = 0;
					}
					else fps_counter++;
				}

				function step1() {
					_requestAnimationFrame(step2);
					call();
				}
				function step2() {
					_requestAnimationFrame(step1);
					call();
				}
				step1();

			}


			return function (cb, req_time_delta) {
				// Fixed update interval (16.666... ms for 60 FPS)
				const TICK = (req_time_delta * 1000) || (1000 / 60);  // milliseconds per update


				let accumulator = 0;
				let lastTime = performance.now();

				// FPS counter variables
				let frameCount = 0;
				let fpsTimer = performance.now();
				let currentFPS = 0;

				function gameLoop(currentTime) {
					// ----- 1. Delta time -----
					const delta = currentTime - lastTime;
					lastTime = currentTime;

					// ----- 2. Accumulate & update -----
					accumulator += delta;
					while (accumulator >= TICK) {

						cb(currentTime, delta / 1000, currentFPS);
						accumulator -= TICK;
					}



					// ----- 4. FPS counter (every second) -----
					frameCount++;
					if (currentTime - fpsTimer >= 1000) {
						currentFPS = frameCount;
						frameCount = 0;
						fpsTimer = currentTime;
					}

					// ----- 5. Next frame -----
					requestAnimationFrame(gameLoop);
				}

				// Start the loop
				requestAnimationFrame(gameLoop);

			}

			function timer(cb, req_time_delta) {
				// Fixed update interval
				const TICK = (req_time_delta * 1000) || (1000 / 60); // milliseconds per update
				const TICK_SECONDS = TICK / 1000; // Convert to seconds for physics

				let accumulator = 0;
				let lastTime = performance.now();

				// FPS counter
				let updateCount = 0;
				let fpsTimer = performance.now();
				let currentFPS = 0;

				function gameLoop(currentTime) {
					// ----- 1. Delta time (cap to prevent spiral of death) -----
					let delta = currentTime - lastTime;
					lastTime = currentTime;

					// Cap delta to prevent huge jumps (e.g., when tab is unfocused)
					if (delta > 100) delta = 100;

					// ----- 2. Accumulate & update -----
					accumulator += delta;
					let updatesThisFrame = 0;

					// Run as many fixed updates as needed
					while (accumulator >= TICK) {
						// Pass TICK_SECONDS as the fixed timestep, NOT delta/1000
						cb(currentTime, TICK_SECONDS, currentFPS);
						accumulator -= TICK;
						updatesThisFrame++;
					}

					// ----- 3. FPS counter (count actual updates) -----
					updateCount += updatesThisFrame;
					if (currentTime - fpsTimer >= 1000) {
						currentFPS = updateCount;
						updateCount = 0;
						fpsTimer = currentTime;
					}

					// ----- 4. Next frame -----
					requestAnimationFrame(gameLoop);
				}

				// Start the loop
				requestAnimationFrame(gameLoop);
			}
			return timer;





		});

	});

	packing.register("dom", function () {

		packing("guid", "define")("dom", function (guid, define) {
			const dom = this;

			NodeList.prototype.map = Array.prototype.map;
			NodeList.prototype.forEach = Array.prototype.forEach;


			const is_dom_element = function (obj) {
				try {
					return (obj instanceof HTMLElement || (obj.textContent !== undefined));

				}
				catch (e) {
					return (typeof obj === "object") &&
						(obj.nodeType === 1) && (typeof obj.style === "object") &&
						(typeof obj.ownerDocument === "object");
				}
			}

			const ext = function (o, e) {
				if (e) {
					let co;
					for (let k in e) {
						if (k == "style") {
							Object.assign(o.style, e[k]);
						}
						else if (k == "abs$") {
							o.style.position = "absolute";
							o.style.left = e[k][0] || "0px";

							o.style.top = e[k][1] || "0px";



						}
						else if (k == "style$") {
							o.setAttribute("style", e[k]);
						}
						else if (k == "html$") {
							o.innerHTML = e[k];
						}
						else if (k == "class$") {
							e[k].split(' ').forEach(function (a) {
								o.classList.add(a);
							})

						}
						else if (k == "options$") {
							dom.$.select.set_options(o, e[k]);
						}
						else if (k == "css$") {
							dom.css(e[k]);
						}
						else if (k == "append$") {
							co = e[k];
							if (define.is_string(co)) co = document.querySelector(co);
							if (co) co.appendChild(o);
						}
						else if (k == "prepend$") {
							co = e[k];
							if (define.is_string(co)) co = document.querySelector(co);
							if (co) co.insertBefore(o, co.firstChild);

						}
						else if (k == "component$") {
							dom.component(o, e[k]);
						}
						else if (k == "attritutes$") {
							Object.assign(o.style, e[k]);
							Object.keys(e[k]).forEach(function (a) {
								o.setAttribute(a, e[k][a]);
							});
						}
						else if (/\$\$\w+/.test(k)) {
							o[k.replace("$$", "")] = o[k.replace("$$", "")] || [];
							if (Array.isArray(e[k])) {
								e[k].forEach(function (itm) {
									o[k.replace("$$", "")].push(itm);
								})
							}
							else o[k.replace("$$", "")].push(e[k]);
						}
						else if (/\$\w+/.test(k)) {
							o.setAttribute(k.replace("$", ""), e[k]);
						}
						else if (k == "size$") {
							o.style.width = e[k];
							o.style.height = e[k];


						}
						else if (/\w+\$/.test(k)) {
							o.style[k.replace("$", "")] = e[k];
						}
						else {
							if (o.set_object) {
								o.set_object(k, e);
							}
							else {
								if (define.is_function(e[k]) && k.indexOf("@") == 0) {
									o.addEventListener(k.replace("@", ""), e[k]);
								}
								else o[k] = e[k];

							}

						}

					}
				}

				return o;
			}
			const headloadings = [], bodyloadings = [];
			dom.css = function (css) {
				let style = document.createElement("style");
				style.type = 'text/css'
				if (style.styleSheet) {
					style.styleSheet.cssText = css;
				} else {
					if (Array.isArray(css)) {
						style.appendChild(document.createTextNode(css.join("")));
					}
					else {
						style.appendChild(document.createTextNode(css));
					}

				}
				dom.add_head(style);

			}
			dom.add_head = function (e) {
				if (document.head) document.head.appendChild(e);
				else headloadings.push(e);
			};
			dom.add_body = function (e) {
				if (document.body) {
					document.body.appendChild(e);
				}
				else bodyloadings.push(e);
				return e;
			};

			dom.load_js = function (url) {
				if (Array.isArray(url)) {
					const pro = [];
					url.forEach(function (u) {
						pro.push(new Promise(function (resolve) {
							const scr = document.createElement("script");
							scr.onload = resolve;
							scr.src = u;
							document.body.appendChild(scr);
						}));
					})
					return Promise.all(pro)
				}

				else {
					return new Promise(function (resolve) {

						const scr = document.createElement("script");
						scr.onload = resolve;
						scr.src = url;
						document.body.appendChild(scr);

					});

				}


			};

			document.addEventListener("DOMContentLoaded", function () {
				headloadings.forEach(function (e) {
					document.head.appendChild(e);
				});
				bodyloadings.forEach(function (e) {
					document.body.appendChild(e);
				});
			});
			dom.elm = function (n) {
				return document.createElement(n);
			};
			dom.strstr = function (str, arg1, arg2, arg3, arg4, arg5) {
				str = "var arr=[];arr.push('" + str
					.replace(/\n/g, "\\n")
					.replace(/[\r\t]/g, " ")
					.split("<?").join("\t")
					.replace(/((^|\?>)[^\t]*)'/g, "$1\r")
					.replace(/\t=(.*?)\?>/g, "',$1,'")
					.split("\t").join("');")
					.split("?>").join("arr.push('")
					.split("\r").join("\\'")

					+ "');return arr.join('');";
				return new Function(arg1, arg2, arg3, arg4, arg5, str);
			};


			dom.def_props = function (o, props) {
				for (let k in props) {
					Object.defineProperty(o, k, { set: props[k][0], get: props[k][1] });
				}

			};

			dom.elm$ = (function () {
				let _html$ = document.createElement('div');
				let e$;
				return function (html) {
					_html$.innerHTML = html;
					e$ = _html$.firstChild;
					_html$.removeChild(e$);
					return e$;
				}
			})();

			const components = { ___loaded: {} };
			dom.components = components;
			dom.$ = components;
			function func_add() {
				if (arguments.length == 1) return this.appendChild(arguments[0]);
				const ret = [];
				for (let i = 0; i < arguments.length; i++) {
					ret[i] = arguments[i];
					this.appendChild(ret[i]);
				}
				return ret;
			}


			function check_str_arg(d, str) {

				if (str.indexOf("##css") === 0) {
					d.cssid = d.cssid || ("css" + dom.guidi());
					d.classList.add(d.cssid);
					str = str.replace("##css", "");
					dom.css(str.replace(/\[cssid\]/g, "." + d.cssid));


					return false;
				}
				else if (str.indexOf("##") === 0) {
					str = str.replace("##", "");
					if (str.indexOf(",") > 0) {
						str.split(",").forEach(function (s) {
							d.classList.add(s.trim());
						});
					}
					else d.classList.add(str);
					return false;
				}
				else if (str.indexOf("$$") === 0) {
					str = str.replace("$$", "");
					d.setAttribute("style", str);
					return false;
				}

				return true;
			}



			function _component(d, args, start) {
				start = start || 0;
				d.add = func_add;
				if (args.length + start == 1) {
					if (Array.isArray(args[0])) {
						d = _component(d, args[0]);
					}
					else if (define.is_string(args[0])) {
						if (check_str_arg(d, args[0])) {
							d.innerHTML = args[0];
						}


					}
					else if (is_dom_element(args[0])) {
						d.appendChild(args[0]);
					}
					else if (define.is_function(args[0]) && args[0].name) {
						d[args[0].name] = args[0];
						if (args[0].name == "create") {
							args[0](d);
						}
					}
					else if (define.is_object(args[0])) {
						d = ext(d, args[0]);
					}

					return d;
				}

				for (let i = start; i < args.length; i++) {
					if (Array.isArray(args[i])) {
						d = _component(d, args[i]);

					}
					else if (define.is_string(args[i])) {
						if (check_str_arg(d, args[i])) {
							if (args[i].length > 0) d.appendChild(ext(dom.elm("span"), { pointerEvents$: "none", innerHTML: args[i] }));
						}


					}
					else if (is_dom_element(args[i])) {
						d.appendChild(args[i]);
					}
					else if (define.is_function(args[i]) && args[i].name) {
						d[args[i].name] = args[i];
						if (args[i].name == "create") {
							args[i](d);
						}
					}
					else if (define.is_object(args[i])) {
						d = ext(d, args[i]);
					}
				}


				return d;
			}

			function component(name) {
				return function () {
					return _component(dom.elm(name), arguments);

				}
			};
			function padString(str, pad) {
				return (pad.substring(0, pad.length - str.length) + str);
			};

			dom.component = _component;
			[
				"a", "abbr", "address", "area", "article", "aside", "audio", "b", "base",
				"bdi", "bdo", "blockquote", "body", "br", "button", "canvas", "caption",
				"cite", "code", "col", "colgroup", "data", "datalist", "dd", "del", "details",
				"dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption",
				"figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head",
				"header", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label",
				"legend", "li", "link", "main", "map", "mark", "math", "menu", "meta", "meter",
				"nav", "noscript", "object", "ol", "optgroup", "option", "output", "p",
				"param", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp",
				"script", "search", "section", "select", "slot", "small", "source", "span",
				"strong", "style", "sub", "summary", "sup", "svg", "table", "tbody", "td",
				"template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track",
				"u", "ul", "var", "video", "wbr"
			].forEach(function (a) {
				components[a] = components[a] || (component(a));
			});
			components["checkbox"] = function checkbox() {
				const e = _component(dom.elm("input"), arguments);
				e.setAttribute("type", "checkbox");
				return e;
			};

			dom.create_event = function (name, params) {
				return new CustomEvent(name, params);
			};

			dom.$ = components;

			dom.auto_resize = function (canv, cb) {
				const rect = canv.getBoundingClientRect();
				if (Math.floor(rect.width) !== canv.width || Math.floor(rect.height) !== canv.height) {
					canv.width = rect.width;
					canv.height = rect.height;
					if (cb) cb(canv.width, canv.height);
				}
			};

			dom.display_status = function display_status() {
				const e = dom.elm("table");
				e.style.width = "100%";
				e.style.zIndex = 1000;
				dom.component(e, arguments);
				e.params = e.params || {};

				window.epr = e;
				const elms = {};
				let k;
				e.add_element = function (elm) {
					this.appendChild(dom.$.tr(dom.$.td(elm)));
					return this;
				};
				e.checkbox = function (name, value, cb, dv) {

					const chk = dom.$.checkbox({
						checked: value, oninput: cb
					});

					dv = dv || this;
					dv.appendChild(dom.$.div(dom.$.label(chk, name)));

					return chk;
				}


				setTimeout(function () {
					setInterval(function () {


						if (e.update) {
							e.update(e.params);
						}
						for (k in e.params) {
							if (!elms[k]) {
								elms[k] = dom.elm("tr");
								elms[k].innerHTML = '<td>' + k + '</td><td></td>';
								e.appendChild(elms[k]);
								elms[k].firstChild.style.textAlign = "left";
								elms[k].lastChild.style.textAlign = "right";
								elms[k] = elms[k].lastChild;
							}
							elms[k].innerText = e.params[k];

						}

					}, e.delay || 500);

					if (e.parentNode === null) {
						document.body.appendChild(e);
					}

				}, 1000);
				return e;
			};

			dom.use_mouse = (function () {
				dom.disable_right_click = function () {
					document.addEventListener('contextmenu', function (e) {
						e.preventDefault()
					});
					return this;
				};
				const overlay = _component(dom.elm("div"), [{ $style: 'position:absolute;left:0;top:0;right:0;bottom:0;background-color:gray;display:none;opacity:0;z-index:99999' }]);
				dom.add_body(overlay);
				return function (elm) {


					let mouse_down_x = undefined, mouse_down_y = undefined;
					elm.mouse_draging = false;
					elm.mouse_drag_buttons = -1;
					elm.mouse_drag_start_buttons = -1;
					elm.mouse_down_buttons = -1;
					elm.mouse_click_buttons = -1;

					elm.hover_dx = 0;
					elm.hover_dy = 0;



					function mouse_move(e) {
						elm.hover_dx = e.clientX - elm.mouse_x;
						elm.hover_dy = e.clientX - elm.mouse_y;


						elm.mouse_x = e.clientX;
						elm.mouse_y = e.clientY;

						if (mouse_down_x === undefined) {
							mouse_down_x = elm.mouse_x;
						}

						if (mouse_down_y === undefined) {
							mouse_down_y = elm.mouse_y;
						}

						let dx = elm.mouse_x - mouse_down_x;
						let dy = elm.mouse_y - mouse_down_y;

						mouse_down_x = e.clientX;
						mouse_down_y = e.clientY;

						elm.mouse_drag_buttons = e.buttons;
						elm.mouse_drag_start_buttons = -1;
						if (elm.mouse_drag && elm.mouse_drag(dx, dy, e) !== false) {
							if (e.buttons !== 0) {
								elm.mouse_draging = true;
							}
						}


					}

					function mouse_up(e) {

						overlay.style.display = "none";
						document.removeEventListener("mousemove", mouse_move);
						document.removeEventListener("mouseup", mouse_up);

						if (!elm.mouse_draging) {
							elm.mouse_click_buttons = elm.mouse_down_buttons;
							if (elm.mouse_click) elm.mouse_click(elm.mouse_x, elm.mouse_y, elm.mouse_down_buttons);
						}
						elm.mouse_drag_buttons = -1;
						elm.mouse_drag_start_buttons = -1;
						elm.mouse_down_buttons = -1;
						elm.mouse_draging = false;

					}
					elm.addEventListener("mousedown", function (e) {
						mouse_down_x = e.clientX;
						mouse_down_y = e.clientY;
						elm.mouse_x = e.clientX;
						elm.mouse_y = e.clientY;
						elm.mouse_down_buttons = e.buttons;
						overlay.style.display = "unset";
						document.addEventListener("mousemove", mouse_move);
						document.addEventListener("mouseup", mouse_up);
						elm.mouse_click_buttons = -1;

						elm.mouse_drag_start_buttons = elm.mouse_down_buttons;
						if (elm.mouse_drag_start && elm.mouse_drag_start(mouse_down_x, mouse_down_y, e) !== false) {

						}

					});


					elm.addEventListener(/Firefox/i.test(navigator.userAgent) ? "DOMMouseScroll" : "mousewheel", function (e) {
						let delta = (e.detail ? e.detail * -120 : e.wheelDelta) * 0.5;
						let rect = elm.getBoundingClientRect();
						e.stopPropagation();
						if (elm.mouse_wheel && elm.mouse_wheel(delta, e.clientX - rect.lef, e.clientY - rect.top, e) === false) return;
					}, false);


					elm.addEventListener("mousemove", mouse_move);

					return elm;
				}

			})();



			dom.css(`
        .collapseable {
          border:solid 1px gray;
          padding-top:24px;
          position:relative;
        }

        .collapseable .header {
          position:absolute;
          top:0px;left:0px;
          padding:4px;
          background-color:rgb(100,100,100,0.8);
          padding-left:16px;
          right:0;
          cursor:pointer;
        }

        .collapseable .header:before {
          content:"-";
          position:absolute;
          left:4px;
        }

        

        .collapseable.collapsed  {
           padding-top:0;
           height:24px !important;
        }

        .collapseable.collapsed .header:before {
          content:"+";
        }

        .collapseable.collapsed > * {
          display:none  !important;
        }
        .collapseable.collapsed  > *:last-child {
          display:block !important;
          position:relative;
        }

        .area_map_selector   .area_map_selector_div{
          width:auto !important;
          height:auto !important;
          overflow:visible !important;

        }
        .overlay .area_map_selector_div {
          margin-left:0px !important;
          margin-top:0px !important;

        }

        `);


			dom.css(`
body * {
user-select:none;
overflow-wrap: anywhere;
}

body input[type="range"],body input[type="text"] {
width:100%;
}

.hover-opacity:hover{
opacity:1 !important;

}
.resizer {position:absolute;left:calc(100% - 10px);top:calc(100% - 10px);user-select: none;pointer-events:fill;cursor: nw-resize;opacity:0;}
.resizer::after {content:"+";position:absolute;left:0;top:0;color:white;}
body {background-color:black;color:white;}
body  *::-webkit-scrollbar{width: 10px;height:10px; background-color:rgba(100,100,100,0.5)}
body *::-webkit-scrollbar-thumb{background-color:rgba(100,100,100,0.75)}
.resizable_div {position:relative;border:solid 1px rgba(50,50,50,0.5);}
.resizable_div_vresizer {position:absolute;left:0;right:0;top:0px;height:8px;background-color:gray;opacity:0;cursor: n-resize;user-select: none;z-index:999999;pointer-events:fill;}
.resizable_div_hresizer {position:absolute;right:-4px;top:0;bottom:0;width:8px !important;background-color:gray;opacity:0;cursor: e-resize;user-select: none;z-index:999999;pointer-events:fill;}
.resizable_div_hlresizer {position:absolute;left:-4px;top:0;bottom:0;width:8px !important;background-color:gray;opacity:0;cursor: e-resize;user-select: none;z-index:999999;pointer-events:fill;}

.resizable_div_resizer {position:absolute;right:-2px;bottom:-2px;width:8px;height:8px;background-color:gray;opacity:0;cursor: nw-resize;user-select: none;z-index:999999;pointer-events:fill;}
.resizable_div_dragger {position:absolute;left:0;right:0;top:0;height:20px;background-color:gray;opacity:0;cursor: move;user-select: none;z-index:999999;pointer-events:fill;}
.node_canvas {background-color:black;}
.node_canvas .node {position:absolute;pointer-events:fill;width:auto;height:auto;display:inline-block;min-width:30px;min-height:20px;border:solid 1px silver;}

.treeview {display:inline-block;margin:1px;padding:2px;}
.treeview li{padding:2px;list-style:none;position:relative;float:left;margin:1px;width:100%;height:auto;cursor:pointer;}
.treeview li >div {display:block;user-select:none;padding-left:16px;border:solid 1px transparent;}
.treeview li >div:hover {border:solid 1px silver;}
.treeview li >.folder::before{content:'+';position:absolute;left:3px;}

.treeview li >.folder > span {pointer-events:none;}
.treeview li.expanded > .folder::before{content:'-';}
.treeview li >ul {display: none !important;pointer-events:fill;margin:1px;padding:2px;}
.treeview li.expanded >ul {display:inline-table !important;width:100%;}
.menu,.menu ul {position:absolute;background-color:silver;color:black;left:20px;top:20px;margin:0;min-width:100px;padding:0px;display:none;}
.menu li {list-style: none; list-style-image: none; width: calc(100% - 10px); padding: 5px;user-select: none;background-color:silver;}
.menu li.submenu {position:relative;}
.menu li.submenu::after {content:"\\00bb";position: absolute;right: 5px;}		
.menu li:hover  {background-color:gray;color:white;z-index:9999;}
.menu li >ul {display1:none;left:100%;top:0;}
.menu li:hover >ul {display:unset;}

.item-list  {background-color:transparent;color:blue;width:100%;pointer-events:none;user-select: none;}
.item-list > div  {background-color:white;pointer-events:fill;padding:3px;user-select: none;}
.item-list > div:hover  {background-color:blue;color:white;}



ul.tabs {position:absolute;left:0;top:0;width:100%;margin:0;padding:0;}
ul.tabs > li.tab_item > span {text-align: center;}
ul.tabs > li.tab_item {list-style: none;list-style-image: none;user-select: none;
  color:silver;background-color:rgba(50,50,50,0.5);display:inline-block;min-width:50px;border-top-left-radius: 5px;border-top-right-radius: 5px;padding-left: 5px;padding-right: 5px;margin-left:5px;}
ul.tabs > li.tab_item.selected,ul.tabs > li.tab_item:hover {background-color:rgba(80,80,80,0.5);color:gray;}
ul.tabs > li.tab_item > div {position:absolute;display:none;left:0;margin-bottom:calc(-100% + 2px);width:100%;background-color:rgba(80,80,80,0.5);;}
ul.tabs > li.tab_item.selected > div {display:block;height:calc(100%);border:solid 0px red;}
.div_window {}
.div_window .div_window_dragger{position:absolute;left:0;top:0;right:0;height:20px;background-color:rgba(100,100,100,0.75);font-size:80%;padding:2px}
.div_window .div_window_collapser {position:absolute;right:1px;top:1px;height:20px;color:#000000;width:20px;transform:scale(1.4);

pointer-events:fill;
cursor:pointer;
z-index:9999;
}
.div_window.div_window_collapsed * {
height:0 !important;
}



.div_window .div_window_collapser:before {
            content:"-";
           }
.div_window.div_window_collapsed .div_window_collapser:before {
            content:"+";
           }

.div_window.div_window_collapsed {
  height:20px !important;
  overflow:hidden;
}

.div_window.div_window_collapsed .div_window_dragger {
height:20px !important;            
}

.div_pointerless {
pointer-events:none !important;
}

.div_pointerless >  * {
pointer-events:fill;
}

.div_button {
border:solid 2px silver;
background-color:gray;
}

.overlay {
position:absolute;left:0;top:0;right:0;bottom:0;background-color:red;display:none;opacity:0;
}

.overlay_dialog {
position:absolute;left:50%;top:50%;
background-color:rgba(140,140,140,0.9);
padding:5px;

}

.overlay_dialog >table  >.buttons   {
padding-bottom:10px;
}
.overlay_dialog >table  >.buttons >td  {
width:50%;
}


           

`);


			let zindex = 99999;
			const overlays = [];
			dom.get_overlay = function () {
				if (overlays.length > 0) {

					const o = dom.add_body(overlays.pop());

					return o;
				}
				const overlay = dom.$.div({ class$: 'overlay' });

				console.log("overlays", overlay);

				overlay.show = function (elm, bring_to_front) {
					this.diag.style.display = "none";
					this._auto_dismis = false;
					this.style.opactiy = 0;
					this.style.zIndex = (zindex++);
					this.style.display = "unset";
					this.is_modal = false;
					if (elm) {
						elm.style.display = "unset";
						if (bring_to_front) elm.style.zIndex = (zindex++);

						this.style.cursor = window.getComputedStyle(elm).cursor;

					}
					else { zindex++; };

					this.elm = elm;
					return this;
				};



				function create_diag(overlay) {
					let diag;
					const ok_button = dom.$.button("Ok", function onclick() {
						if (diag.confirm && diag.confirm() != false) {
							overlay.dismis();
						}
					});

					const cancel_button = dom.$.button("cancel", function onclick() {
						overlay.dismis();
					});

					diag = dom.$.div({ class$: "overlay_dialog" }, dom.$.table(
						dom.$.tr(dom.$.td({ $colspan: "2", class$: "content" })),
						dom.$.tr({ class$: "buttons" },
							dom.$.td(cancel_button),
							dom.$.td({ $align: "right" }, ok_button))
					));
					diag.ok_button = ok_button;
					diag.cancel_button = cancel_button;
					diag.last_content = null;
					diag.last_content_parent = null;
					diag.init = function (content, opts) {
						ok_button.innerHTML = opts.ok_title || "Ok";
						cancel_button.innerHTML = opts.cancel_title || "cancel";
						this.confirm = opts.confirm || null;
						if (this.last_content) {
							this.last_content_parent.appendChild(this.last_content);

						}
						this.last_content = content;
						this.last_content_parent = content.parentNode || document.body;
						this.querySelector(".content").appendChild(content);

						overlay.is_modal = opts.modal;

					};
					return diag;
				}

				overlay.diag = create_diag(overlay);





				dom.add_body(overlay.diag);

				overlay.diag.style.display = "none";
				overlay.show_dialog = function (content, opts) {
					this._auto_dismis = false;
					this.style.opactiy = 0;
					this.style.zIndex = (zindex++);
					this.style.display = "unset";
					this.diag.init(content, opts || {});
					this.diag.style.display = "unset";
					this.diag.style.zIndex = (zindex++);
					const rect = this.diag.getBoundingClientRect();
					this.diag.style.marginLeft = (-rect.width * 0.5) + "px";
					this.diag.style.marginTop = (-rect.height * 0.5) + "px";

					return this.diag;
				};


				overlay.auto_dismis = function () {
					this._auto_dismis = true;
					return this;
				};

				overlay.dismis = function () {
					zindex -= 2;
					this.style.display = "none";
					if (this.elm && this.elm.dismis) {
						// this.elm.style.zIndex = "unset";
						this.elm.dismis();

					}
					this.diag.style.display = "none";
					overlays.push(this);
				};
				overlay.onmousedown = function () {
					if (!this.is_modal) this.dismis();
				};
				overlay.onmousemove = function () {
					if (this._auto_dismis) this.dismis();
				};

				dom.add_body(overlay);
				return overlay;
			};

			dom.components["resizer"] = function resizer() {
				const elm = dom.elm("div");
				elm.classList.add("resizer");
				dom.component(elm, arguments);
				elm.mode = 3;
				elm.onmousedown = dom.start_drag;

				return elm;
			};


			dom.show_dropdown = (function () {

				const drop_container = dom.$.div({ $style: "position:absolute;pointer-events:none" });
				let overlay;
				drop_container.show = function () {
					overlay = dom.get_overlay();
					drop_container.bring_to_front = true;
					dom.add_body(drop_container);
					overlay.show(drop_container, true);
					//overlay.style.opacity = 0.5;

				};
				drop_container.ondismise = function () { };
				drop_container.dismis = function () {
					this.style.display = "none";
					this.ondismise();
				};
				drop_container.hide = function () {
					overlay.dismis();

				};


				drop_container.dismis();
				return function (elm, dropdown, cb) {
					const rect = elm.getBoundingClientRect();
					drop_container.style.left = rect.left + "px";
					drop_container.style.top = (rect.top + 0) + "px";


					dropdown.old_parent = dropdown.parentNode;

					drop_container.appendChild(dropdown);

					drop_container.show();
					drop_container.ondismise = function () {
						if (dropdown) {
							if (dropdown.old_parent) {
								dropdown.old_parent.appendChild(dropdown);
							}
							else {
								drop_container.removeChild(dropdown);
							}


						}
						if (cb) cb();
					};

					drop_container.style.width = Math.max(dropdown.getBoundingClientRect().width, rect.width) + "px";

					return drop_container;

				};

			})();
			function on_drag_elm_start(e) {
				for (let k in e.target.drag_data) {
					e.dataTransfer.setData(k, e.target.drag_data[k]);
				}
			}
			dom.drag_elm_start = function (elm, data) {
				elm.drag_data = data;
				elm.ondragstart = on_drag_elm_start;
			}

			dom.start_drag = (function () {

				let mouse_down_x, mouse_down_y, mouse_down_target, drag_overlay;

				let last_drag_time = 0;
				let start_drag_function_cb, start_drag_function_cb_done;
				const drage_resize = dom.create_event("drage_resize", {});
				const mouse_move = function (e) {
					if (Date.now() - last_drag_time > 15) {
						last_drag_time = Date.now();
						let dx = e.clientX - mouse_down_x;
						let dy = e.clientY - mouse_down_y;
						if (start_drag_function_cb !== undefined) {
							start_drag_function_cb(dx, dy, e);
						}
						else if (mouse_down_target) {
							const tar = mouse_down_target;
							e.preventDefault();

							if (tar.mode) {
								const par = tar.parentNode;
								let rect = par.getBoundingClientRect();
								if (tar.mode === 1) {
									if (parseInt(par.style.width) > 0 || rect.width > 0) {
										dx = dx * (tar.direction == undefined ? 1 : tar.direction);
										if (par.style.width.indexOf("px") > 0) {
											par.style.width = Math.max(1, (parseInt(par.style.width) + (dx))) + "px";
										}
										else {
											par.style.width = Math.max(1, (rect.width + (dx))) + "px";
										}
									}
								}
								else if (tar.mode === 2) {
									if (parseInt(par.style.height) > 0 || rect.height > 0) {
										if (par.style.height.indexOf("px") > 0) {
											par.style.height = Math.max(1, (parseInt(par.style.height) - (dy))) + "px";
										}
										else {
											par.style.height = Math.max(1, (rect.height + (dy))) + "px";
										}
									}
								}
								else if (tar.mode === 3) {
									if (parseInt(par.style.width) > 0 || rect.width > 0) {
										if (par.style.width.indexOf("px") > 0) {
											par.style.width = Math.max(1, (parseInt(par.style.width) + (dx))) + "px";
										}
										else {
											par.style.width = Math.max(1, (rect.width + (dx))) + "px";
										}
									}

									if (parseInt(par.style.height) > 0 || rect.height > 0) {
										if (par.style.height.indexOf("px") > 0) {
											par.style.height = Math.max(1, (parseInt(par.style.height) + (dy))) + "px";
										}
										else {
											par.style.height = Math.max(1, (rect.height + (dy))) + "px";
										}
									}

								}

								else if (tar.mode === 4) {
									if (par.style.left !== undefined) {
										par.style.left = (parseInt(par.style.left) + dx) + "px";
									}

									if (par.style.top !== undefined) {
										par.style.top = (parseInt(par.style.top) + dy) + "px";
									}

								}
								else if (tar.mode === 10) {


									console.log("dx", dx, dy);
									if (dy < 5 || dx < 5) {

										if (par != par.parentNode.firstChild) {
											par.parentNode.insertBefore(par.previousSibling, par);
										}

									}
									else if (dx > 5 || dy > 5) {

										if (par == par.parentNode.lastChild) {
											return;
										}
										if (par.nextSibling) {
											par.parentNode.insertAfter(par.nextSibling, par);
										}
									}
								}


								document.dispatchEvent(drage_resize);
								//if (window.onresize) window.onresize();
							}
							else {
								if (tar.ondrage) {
									if (tar.ondrage(dx, dy, e) === false) {
										mouse_down_x = e.clientX;
										mouse_down_y = e.clientY;
										return;

									}

								}
								if (tar.style.left !== undefined) {
									tar.style.left = (parseInt(tar.style.left) + dx) + "px";
								}

								if (tar.style.top !== undefined) {
									tar.style.top = (parseInt(tar.style.top) + dy) + "px";
								}


							}


						}

						mouse_down_x = e.clientX;
						mouse_down_y = e.clientY;

					}

				}



				function mouse_up(e) {
					last_drag_time = 0;
					drag_overlay.dismis();
					if (mouse_down_target) {
						if (mouse_down_target.drag_opacity) {
							mouse_down_target.style.opacity = 0;
						}
					}
					if (start_drag_function_cb_done) {
						start_drag_function_cb_done(e);
					}
					start_drag_function_cb = undefined;
					start_drag_function_cb_done = undefined;
					mouse_down_target = undefined;
					document.removeEventListener("mousemove", mouse_move);
					document.removeEventListener("mouseup", mouse_up);
				}


				dom.start_drag_function = function (x, y, cb, done_cb, elm) {
					start_drag_function_cb = cb;
					start_drag_function_cb_done = done_cb;
					mouse_down_x = x;
					mouse_down_y = y;
					drag_overlay = dom.get_overlay();
					drag_overlay.show(elm);
					document.addEventListener("mousemove", mouse_move);
					document.addEventListener("mouseup", mouse_up);
				};


				return function (e) {
					mouse_down_x = e.clientX;
					mouse_down_y = e.clientY;
					mouse_down_target = e.target;

					if (mouse_down_target.drag_opacity) {
						mouse_down_target.style.opacity = mouse_down_target.drag_opacity;
					}

					e.stopPropagation();
					e.preventDefault();
					drag_overlay = dom.get_overlay();
					drag_overlay.show(mouse_down_target);
					document.addEventListener("mousemove", mouse_move);
					document.addEventListener("mouseup", mouse_up);

				}


			})();


			dom.$.div.collapseable = function () {
				const d = dom.$.div.apply(dom, arguments);
				d.classList.add("collapseable");
				d.appendChild(dom.$.div({
					$class: "header", onclick: function () {

						d.classList.toggle("collapsed");
						if (d.on_collapsed) d.on_collapsed(d.classList.contains("collapsed"))
					}
				}, d.heading || "&nbsp;"));
				d.insert_top = function (e) {
					d.insertBefore(e, d.firstChild);
				};
				d.insert_bottom = function (e) {
					d.insertBefore(e, d.lastChild);
				};
				return d;
			};

			dom.$.div.window = function () {
				const d = dom.$.div.apply(dom, arguments);
				d.classList.add("div_window");
				d.appendChild(dom.$.div({ $class: "div_window_dragger", mode: 4, onmousedown: dom.start_drag, }, d.heading,
					d.collapseable ? dom.$.div({
						$class: "div_window_collapser", onmousedown: function () {
							d.classList.toggle("div_window_collapsed");

						}
					}) : undefined
				));



				if (d.resizeable) {
					d.appendChild(dom.$.resizer());
				}

				return d;
			};


			dom.create_canvas = (function () {

				function create_canvas(w, h, doc) {
					if (!h) h = w;
					doc = doc || document;
					var temp_canvas = doc.createElement('canvas');
					temp_canvas.ctx = temp_canvas.getContext('2d', {});

					temp_canvas.width = w;
					temp_canvas.height = h;
					temp_canvas.set_size = function (ww, hh) {
						this.width = ww;
						this.height = hh;
					};
					temp_canvas.get_image_data = function () {
						return this.ctx.getImageData(0, 0, this.width, this.height);
					};

					temp_canvas._get_image_data = function () {
						this.imd = this.ctx.getImageData(0, 0, this.width, this.height);
						return this.imd;
					};

					temp_canvas.get_image_data_at = function (x, y, w, h) {
						return this.ctx.getImageData(x, y, w, h);
					};

					temp_canvas._put_image_data = function (imd) {
						this.ctx.putImageData(imd || this.imd, 0, 0);
					};

					temp_canvas._put_image_data_at = function (imd, x, y) {
						this.ctx.putImageData(imd, x, y);
					};

					temp_canvas.blob_promise = function (type) {
						return new Promise(function (resolve) {
							temp_canvas.toBlob(resolve, type);
						});
					};






					let sc, mw, mh;



					temp_canvas.draw_image_fit = function (img, ww, hh) {

						sc = this.width / ww;
						mw = ww * sc;
						mh = hh * sc;

						if (mh > this.height) {
							sc = this.height / mh;
							mw = mw * sc;
							mh = mh * sc;
						}

						// this.ctx.fillStyle = "red";
						// this.ctx.fillRect(0, 0, this.width, this.height);

						this.ctx.drawImage(img,
							((this.width * 0.5) - (mw * 0.5)),
							((this.height * 0.5) - (mh * 0.5)),

							mw, mh);



					};

					temp_canvas.draw_image_center_fit = function (img, pad, mw, mh, sca, ox, oy) {

						pad = (pad !== undefined) ? pad : 0;

						mw = mw || img.width;

						mh = mh || img.height;
						sc = (this.height - pad * 4) / (mh);


						sc = sc * (sca || 1);

						mh *= sc;
						mw *= sc;
						ox = ox || 0;
						oy = oy || 0;

						this.ctx.drawImage(img,
							((this.width * 0.5) - (mw * 0.5)) + ox,
							((this.height * 0.5) - (mh * 0.5)) + oy,

							mw, mh);
					}




					return temp_canvas;
				}
				const pool = [];
				create_canvas.get = function (w, h) {
					let c;
					if (pool.length > 0) {
						c = pool.pop();
						c.set_size(w, h)
					}
					else {
						c = create_canvas(w, h);
						c.ctx.imageSmoothingEnabled = false;
					}
					return c;
				}
				create_canvas.free = function (c) {
					pool.push(c);
				};

				dom.empty_canvas = function () {
					const e = dom.elm("canvas");
					e.style.width = "calc(100%)";
					e.style.height = "calc(100%)";
					dom.component(e, arguments);

					return e;
				};
				const each = function (callback, index) {
					const func = function (index) {
						callback(func, index);
					};
					func(index || 0);
				};


				dom.canvas_image_data = (function () {
					const parking = [];
					const canv = create_canvas(1, 1);
					const img = new Image();
					canv.setAttribute("willReadFrequently", true);
					img.crossOrigin = "Anonymous";
					img.is_busy = false;
					function process(url, cb, w, h, image_data) {
						if (img.is_busy) {
							parking.unshift([url, cb, w, h, image_data]);
							return;
						}
						if (Array.isArray(url)) {

							const datas = [];
							each(function (next, index) {
								img.onload = function () {
									canv.set_size(w || this.width, h || this.height);
									canv.ctx.drawImage(this, 0, 0, canv.width, canv.height);
									datas.push(canv._get_image_data());
									if (index < url.length - 1) {
										next(index + 1);
									}
									else {
										if (cb) cb(datas);
										this.is_busy = false;
										if (parking.length > 0) {
											process.apply(this, parking.pop());
										}
									}


								};
								img.onerror = function () {
									canv.set_size(w || this.width, h || this.height);

									datas.push(canv._get_image_data());
									if (index < url.length - 1) {
										next(index + 1);
									}
									else {
										if (cb) cb(datas);
										this.is_busy = false;
										if (parking.length > 0) {
											process.apply(this, parking.pop());
										}
									}
								};
								img.is_busy = true;
								img.src = url[index];


							});
						}
						else {
							img.onload = function () {
								if (image_data) {
									canv.set_size(w || this.width, h || this.height);
									canv.ctx.drawImage(this, 0, 0, canv.width, canv.height);
									if (cb) cb(canv._get_image_data().data, canv.width, canv.height, this);
									canv._put_image_data();
								}
								else {
									if (cb) cb(this, this.width, this.height);
								}

								this.is_busy = false;
								if (parking.length > 0) {
									process.apply(this, parking.pop());
								}
							};
							img.is_busy = true;
							img.src = url;
						}


					}

					dom.working_image = function (url, cb) {
						return process(url, cb);
					};
					return function (url, cb, w, h) {
						return process(url, cb, w, h, true);
					}





				})();

				return create_canvas;
			})();

			dom.download_file = (function () {
				var element = document.createElement('a');
				element.style.display = 'none';
				return function (name, url) {
					element.setAttribute('href', url);
					element.setAttribute('download', name);
					document.body.appendChild(element);
					element.click();
					document.body.removeChild(element);
				}
			})();

			dom.components["treeview"] = function treeview() {
				const t = dom.$.ul({ $class: "treeview" });
				dom.component(t, arguments);
				t.onclick = function (e) {
					if (e.target.classList.contains("folder")) {
						e.target.parentNode.classList.toggle("expanded");
					}
				};
				return t;
			};


			dom.components["treenode"] = function treenode() {
				const d = dom.component(dom.$.div(), arguments);
				const t = dom.$.li(d, d.childNodes.length > 1 ? (d.childNodes[1].tagName.toLowerCase() == "ul" ? d.childNodes[1] : dom.$.ul(d.childNodes.map(function (m, i) {
					if (i > 0) return m;
					return undefined;
				}))) : undefined);

				if (t.childNodes.length > 1) {
					t.firstChild.classList.add("folder");
					t.classList.add("folder-node");
					if (d.expanded) {
						t.classList.add("expanded");
					}
				}





				return t;
			};

			dom.components["treeview"].node = dom.components["treenode"];


			dom.components["pan_div"] = function pan_div() {
				const inner = dom.elm("div");

				const pd = dom.elm("div");
				pd.appendChild(inner);

				pd.inner = inner;

				pd.mouse_down_x = 0;
				pd.mouse_down_y = 0;
				pd.scale_delta = 0.002;
				pd.updated = pd.mouse_move = pd.mouse_down = pd.mouse_up = pd.mouse_tap = pd.mouse_drag = function () { };
				pd.mouse_wheel = function (delta, x, y, e) { };

				//	
				dom.component(pd, arguments);
				dom.component(inner, arguments);
				pd.scale = pd.scale || 1;
				pd.pan_x = 0;
				pd.pan_y = 0;

				pd.mouse_x = 0;
				pd.mouse_y = 0;

				if (!pd.style.position) {
					pd.style.position = "relative";
				}

				pd.style.width = pd.style.width || "100%";
				pd.style.height = pd.style.height || "100%";


				pd.style.overflow = "hidden";


				inner.setAttribute("style", "position:absolute;left:0;top:0;width:0;height:0;posinter-events:fill");


				pd.enable_screen_drage = function () {
					pd.style.pointerEvents = "none";
					inner.onmousedown = function () {
						pd.style.pointerEvents = "fill";
						inner.style.pointerEvents = "none";

					};
					document.addEventListener("mouseup", function () {
						pd.style.pointerEvents = "none";
					});
				};

				inner.onmousedown = function () {
					//pd.style.pointerEvents = "fill";
					//inner.style.pointerEvents = "none";

				};
				inner.style.pointerEvents = "fill";



				pd.update = function () {

					inner.style.left = (pd.pan_x * pd.scale) + "px";
					inner.style.top = (pd.pan_y * pd.scale) + "px";
					inner.style.transform = " scale(" + pd.scale + ")";
					inner.rect = inner.getBoundingClientRect();
					this.rect = this.getBoundingClientRect();
					pd.updated();
				};


				const mouse_wheel = function (e) {
					const delta = (e.detail ? e.detail * -120 : e.wheelDelta) * 0.5;
					const rect = pd.getBoundingClientRect();

					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					e.stopPropagation();
					e.preventDefault();
					if (pd.mouse_wheel(delta, x, y, e) === false) return;

					const last_scale = pd.scale;
					pd.scale = Math.max(pd.scale + delta * (pd.scale_delta * last_scale), 0.15);

					const dx = x / last_scale - x / pd.scale;
					const dy = y / last_scale - y / pd.scale;
					pd.pan_x -= dx;
					pd.pan_y -= dy;
					pd.update();
				};

				pd.reset_view = function () {
					pd.scale = 1;
					pd.pan_x = 0;
					pd.pan_y = 0;
					pd.update();
				};

				pd.scale_view = function (s) {
					pd.scale = s;
					pd.pan_x = 0;
					pd.pan_y = 0;
					pd.update();
				};

				const mouse_up = function (e) {
					pd.mouse_up(e)
					//	pd.style.pointerEvents = "none";
					inner.style.pointerEvents = "fill";

					if (pd.mouse_is_down) {
						pd.mouse_is_tap = true;
						pd.mouse_tap(e)
					}
					pd.update();
					pd.enable_paning = true;
					pd.mouse_is_tap = false;
					pd.mouse_holding_down = false;
				};

				const mouse_down = function (e) {

					//if (e.target !== pd) return pd.update();
					const rect = pd.getBoundingClientRect();
					pd.mouse_down_x = e.clientX - rect.left;
					pd.mouse_down_y = e.clientY - rect.top;

					pd.mouse_x = pd.mouse_down_x / pd.scale - pd.pan_x;
					pd.mouse_y = pd.mouse_down_y / pd.scale - pd.pan_y;
					if (pd.mouse_down(e) === false) return;

					pd.mouse_is_down = true;
					pd.mouse_holding_down = true;
					pd.update();
				};


				const mouse_move = function (e) {
					const rect = pd.getBoundingClientRect();

					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					pd.mouse_rx = x;
					pd.mouse_ry = y;

					pd.mouse_x = x / pd.scale - pd.pan_x;
					pd.mouse_y = y / pd.scale - pd.pan_y;

					if (pd.mouse_move(e) === false) return;

					pd.mouse_is_down = false;
					const dx = (x - pd.mouse_down_x) / pd.scale;
					const dy = (y - pd.mouse_down_y) / pd.scale;
					if (e.buttons !== 0) {
						if ((pd.mouse_holding_down && pd.mouse_drag(dx, dy, e, pd.mouse_down_target) !== false) && (e.target === pd)) {
							pd.pan_x += dx;
							pd.pan_y += dy;
						}

						pd.mouse_down_x = x;
						pd.mouse_down_y = y;
						e.stopPropagation();
					}
					pd.update();
				};

				document.addEventListener("mouseup", function () {
					pd.mouse_holding_down = false;
				});

				pd.addEventListener("mouseup", mouse_up);
				pd.addEventListener("mousedown", mouse_down);
				pd.addEventListener("mousemove", mouse_move);

				pd.addEventListener(/Firefox/i.test(navigator.userAgent) ? "DOMMouseScroll" : "mousewheel", mouse_wheel, false);




				pd.canvas2d = function (cb) {
					const pd = this;
					pd.canv2d = dom.create_canvas(1, 1);
					const on_render = new CustomEvent("on_render", {});
					const on_init = new CustomEvent("on_init", {});
					pd.canv2d.style.width = "100%";
					pd.canv2d.style.height = "100%";
					pd.canv2d.style.position = "absolute";
					pd.canv2d.style.pointerEvents = "none";
					const canv = pd.canv2d;
					const ctx = pd.canv2d.ctx;

					pd.insertBefore(canv, pd.inner);

					canv.render_grid = function (grid_size, grid_color) {
						ctx.lineWidth = 1 / pd.scale;
						const w = canv.width / pd.scale;
						const h = canv.height / pd.scale;

						const xs = -(Math.floor(pd.pan_x / grid_size) + 1) * grid_size;
						const ys = -(Math.floor(pd.pan_y / grid_size) + 1) * grid_size;
						const xe = xs + (w / grid_size + 1) * grid_size;
						const ye = ys + (h / grid_size + 1) * grid_size;


						let x, y;


						ctx.strokeStyle = grid_color;
						ctx.beginPath();
						for (x = xs; x < xe; x += grid_size) {
							ctx.moveTo(x, ys);
							ctx.lineTo(x, ye);
						}

						for (y = ys; y < ye; y += grid_size) {
							ctx.moveTo(xs, y);
							ctx.lineTo(xe, y);
						}


						ctx.stroke();

						ctx.lineWidth = 1;
					};



					canv.grid = function (grid_size, cb) {

						ctx.lineWidth = 1 / pd.scale;
						const w = canv.width / pd.scale;
						const h = canv.height / pd.scale;

						const xs = -(Math.floor(pd.pan_x / grid_size) + 1) * grid_size;
						const ys = -(Math.floor(pd.pan_y / grid_size) + 1) * grid_size;
						const xe = xs + (w / grid_size + 1) * grid_size;
						const ye = ys + (h / grid_size + 1) * grid_size;


						let x, y;
						canv.grid_xs = xs;
						canv.grid_ys = ys;
						canv.grid_xe = xe;
						canv.grid_ye = ye;

						canv.grid_w = (xe - xs);
						canv.grid_h = (ye - ys);

						for (x = xs; x < xe; x += grid_size) {

							for (y = ys; y < ye; y += grid_size) {
								cb(x, y, xs, ys, xe, ye);
							}
						}

						ctx.lineWidth = 1;
					};


					canv.on_render = function () {

					};

					canv.on_background_render = function () {

					};
					canv.on_foreground_render = function () {

					};




					pd.updated = function () {
						pd.rect = canv.getBoundingClientRect();

						width = pd.rect.right - pd.rect.left;
						height = pd.rect.bottom - pd.rect.top;

						if (width !== canv.width || height !== canv.height) {
							canv.width = width;
							canv.height = height;
							if (pd.pan_to_fixed) {
								pd.pan_x = canv.width * pd.pan_to_fixed[0];
								pd.pan_y = canv.height * pd.pan_to_fixed[1];

								pd.pan_x -= (pd.pan_x - (pd.pan_x / pd.scale));
								pd.pan_y -= (pd.pan_y - (pd.pan_y / pd.scale));

							}
						}

						ctx.clearRect(0, 0, canv.width, canv.height);
						ctx.canvas_scale = pd.scale;
						canv.on_background_render(ctx);
						ctx.save();
						ctx.scale(pd.scale, pd.scale);
						ctx.translate(pd.pan_x, pd.pan_y);
						if (canv.on_render(ctx) !== false) {
							pd.dispatchEvent(on_render);
						}

						ctx.restore();
						canv.on_foreground_render(ctx);
					};


					if (cb) cb(canv);
					pd.dispatchEvent(on_init);
					return canv;

				}

				pd.canvas2d_edit_points = function (cb) {
					const pd = this;
					const value = pd.value;

					return pd.canvas2d(function (canv) {

						canv.points = [];
						dom.def_props(pd, {
							value: [
								function (value) {
									canv.points = value;
								},
								function () {
									return canv.points;
								}
							],
						});

						if (value) pd.value = value;


						function check_mouse_point(x, y, rad) {
							return (Math.pow(x - pd.mouse_x, 2) + Math.pow(y - pd.mouse_y, 2)) < (rad * rad);
						}

						pd.point_title = function (p) {
							return p[0].toFixed(2) + " , " + p[1].toFixed(2);
						};


						canv.edit_points = function (ctx) {
							let w = (1 / pd.scale) * 4;
							canv.points.forEach(function (p) {
								ctx.fillStyle = "rgba(0,255,0,0.5)";
								ctx.fillRect(p[0] - w, p[1] - w, w * 2, w * 2);
							});
							const p = canv.active_point;
							if (p) {
								ctx.fillStyle = "white";
								ctx.font = (Math.max(0.025, (1 / pd.scale)) * 4) + "px arial";
								ctx.fillText(pd.point_title(p), p[0], p[1] - ((1 / pd.scale) * 10));
								w *= 1.2;
								ctx.fillStyle = "rgba(255,0,0,0.5)";
								ctx.fillRect(p[0] - w, p[1] - w, w * 2, w * 2);
							}
						}
						pd.mouse_down = function (e) {

							if (e.buttons == 1) {

								canv.active_point = null;
								let w = (1 / pd.scale) * 4;
								canv.points.forEach(function (p) {
									if (check_mouse_point(p[0], p[1], w * 2)) {
										canv.active_point = p;
									}
								});
							};

						}
						pd.mouse_drag = function (dx, dy, e, mouse_down_target) {

							if (canv.active_point) {
								if (pd.edit_points) {
									if (pd.edit_points(canv.active_point, dx, dy) === false) {
										return false;
									}
								}
								canv.active_point[0] += dx;
								canv.active_point[1] += dy;


								return false;
							}

						};

						if (cb) cb(canv);

					});
				}
				return pd;
			};

			dom.components["node_canvas"] = function node_canvas() {

				const nd = dom.components["pan_div"]({ class$: "node_canvas" });


				dom.component(nd, arguments);
				const update_canvas = new CustomEvent("update_canvas", {});
				nd.add_background = function (elm, elb) {
					this.insertBefore(elm, elb || this.inner);

				};

				let draging_node, mousedown_node;

				nd.update_canvas = function () {
					nd.dispatchEvent(update_canvas);
				};

				nd.drag_node = function (node, dx, dy) {
					if (node.style.left !== undefined) {
						node.style.left = (parseFloat(node.style.left) + dx) + "px";
					}

					if (node.style.top !== undefined) {
						node.style.top = (parseFloat(node.style.top) + dy) + "px";
					}
				}


				function drag_node(dx, dy) {
					nd.drag_node(draging_node, (dx / nd.scale), (dy / nd.scale));
					nd.update_canvas();
				};

				nd.mouse_down = function (e) {



					if (e.target.classList.contains("node")) {
						mousedown_node = e.target;
						draging_node = null;
						return false;
						draging_node = e.target;

						if (!draging_node.prevent_bring_to_front) {
							draging_node.parentNode.appendChild(draging_node);
						}

						dom.start_drag_function(e.clientX, e.clientY, drag_node);
						e.preventDefault();
						return false;
					}



				};


				nd.mouse_wheel = function (delta, x, y, e) {
					nd.update_canvas();
				};

				nd.mouse_move = function (e) {
					if (e.buttons > 0) {

						if (e.target.classList.contains("node")) {
							if (draging_node !== e.target && mousedown_node == e.target) {
								draging_node = e.target;
								if (!draging_node.prevent_bring_to_front) {
									draging_node.parentNode.appendChild(draging_node);
								}

								dom.start_drag_function(e.clientX, e.clientY, drag_node);
								e.preventDefault();
								return false;
							}
						}

						nd.update_canvas();
					}
				};

				nd.create_node = function () {
					const nod = dom.$.div({ class$: "node" });
					nod.style.left = "0px";
					nod.style.top = "0px";
					dom.component(nod, arguments);


					this.inner.appendChild(nod);

					return nod;
				};

				if (nd.ready) {
					nd.ready(nd);
				}

				return nd;
			};


			return dom;

		});

	});

	packing.register("dom.color_input", function () {
		packing("dom", "define")("dom.color_input", function (dom, define) {
			dom.css(`
        .input_slide {
          position:relative;
          background-color:rgba(100,100,100,0.5);
          overflow:hidden;
          margin-bottom:10px;
        }

        .input_slide > input {
          border:none;
          background:none;
          color:silver;
           cursor: e-resize;
           padding:5px;
        }

        .input_slide > span {
          position:absolute;
          left:0;top:0;bottom:0;
          pointer-events:none;
          background-color:rgba(100,100,100,0.5);
        }
.value_slider{
width:100%;
}

        `);


			const _divinput = dom.create_event("input", { bubbles: true });

			const value_slider = dom.components["value_slider"] = function value_slider() {

				const _div = dom.elm("div");
				_div.classList.add("value_slider");
				const _slider = dom.elm("input");
				_slider.setAttribute("type", "range");
				const _input = dom.elm("input");
				_input.setAttribute("type", "text");

				dom.def_props(_div, {
					value: [
						function (value) {
							value = parseFloat(value);
							_input.value = value;
							_slider.value = value;
							_div._value = value;
						},
						function () {
							return parseFloat(_div._value);
						}
					],
					min: [
						function (value) {
							_slider.min = value;
						},
						function () {
							return _slider.min;
						}
					],
					max: [
						function (value) {
							_slider.max = value;
						},
						function () {
							return _slider.max;
						}
					],
					step: [
						function (value) {
							_slider.step = value;
						},
						function () {
							return _slider.step;
						}
					]
				});
				dom.component(_div, arguments);
				_div.style.display = _div.style.display || "inline-block";






				_slider.style.width = "calc(80% - 4px)";
				_slider.style.margin = "0";
				_slider.style.float = "left";

				_input.style.float = "left";
				_input.style.width = "calc(20% - 2px)";
				_input.style.margin = "0";
				_input.style.padding = "0";

				//_slider.setAttribute("style", "position:absolute;left:0;top:0;border:solid 1px red");
				_input.value = _slider.value;
				_div._value = _input.value;

				_slider.oninput = function (e) {
					e.preventDefault();
					e.stopPropagation();
					_input.value = _slider.value;
					_div._value = _input.value;
					//if (_div.oninput) _div.oninput(_slider.value);
					_div.dispatchEvent(_divinput);

					return false;
				};

				_input.oninput = function (e) {
					e.preventDefault();
					e.stopPropagation();
					_slider.value = _input.value;

					_div._value = _input.value;
					//if (_div.oninput) _div.oninput(_slider.value);
					_div.dispatchEvent(_divinput);

					return false;
				};

				_input.value = _slider.value;
				_div.appendChild(_slider);
				_div.appendChild(_input);
				return _div;
			};

			dom.components["input_slide"] = (function () {
				let sinput, inc_value;
				function _slide_input(dx, dy) {
					sinput.value = parseFloat(sinput.value) + ((dx * 0.5) * inc_value);
					sinput.parentNode.set_value(parseFloat(sinput.value).toFixed(sinput.parentNode.decimals));

					sinput.parentNode.dispatchEvent(_divinput);
				}
				function _slide_input_end() {

				}
				function input_slide() {
					//	const _divinput = dom.create_event("input", { bubbles: true });
					const _div = dom.component(dom.elm("div"), arguments);

					_div.classList.add("input_slide");

					const _input = dom.elm("input");

					_input.setAttribute("type", "text");
					_input.style.border = "none";



					dom.def_props(_div, {
						value: [
							function (value) {
								_div.set_value(value);
							},
							function () {
								if (_div.mode == "text") return _input.value;

								return _div.format_value();
							}
						],
					});


					_input.oninput = function (e) {
						e.preventDefault();
						e.stopPropagation();
						//_div.set_value(this.value);
						_div.dispatchEvent(_divinput);
						return false;
					};

					_input.onblur = function (e) {
						e.preventDefault();
						e.stopPropagation();
						_div.set_value(this.value);
						//	_div.dispatchEvent(_divinput);
						return false;
					};

					_div.appendChild(_input);

					_input.setAttribute("autofocus", "autofocus");
					_input.setAttribute("onfocus", "this.select()");

					if (_div.decimals == undefined) _div.decimals = input_slide.decimals;
					_div.format_value = function () {
						//_input.value = parseFloat(_input.value).toFixed(_div.decimals);
						let value = parseFloat(_input.value)
						if (_div.max !== undefined) {
							value = Math.min(value, _div.max);
						}

						if (_div.min !== undefined) {
							value = Math.max(value, _div.min);
						}

						return sinput ? value.toFixed(sinput.parentNode.decimals) : value.toFixed(5);
					};

					_div.set_value = function (value) {
						if (_div.mode == "text") {
							_input.value = value;
							return;
						}
						if (value == "-") return;


						value = parseFloat("" + value);


						if (_div.max !== undefined) {
							value = Math.min(value, _div.max);
						}

						if (_div.min !== undefined) {
							value = Math.max(value, _div.min);
						}

						if (isNaN(value)) {

							value = 0;
						}
						_input.value = value.toFixed(_div.decimals);

						//if (_div.decimals == 0) _input.value = parseInt(value); else


					};


					_input.onmousedown = function (e) {
						if (_div.mode == "text") return;
						sinput = this;
						if (_div.inc !== undefined) {
							inc_value = _div.inc;
						}
						else {
							inc_value = parseFloat(this.value);
							inc_value = Math.max(0.01, inc_value * 0.01);
						}
						dom.start_drag_function(e.clientX, e.clientY, _slide_input, _slide_input_end, sinput);
					};

					_div._input = _input;

					return _div;
				};
				input_slide.decimals = 0;
				return input_slide;
			})();

			dom.components["color_input"] = (function () {
				const _colorinput = dom.create_event("input", { bubbles: true });
				const canv = dom.$.canvas({ width: 128, height: 128, float$: "left", width$: "128px", height$: "128px" });
				const cinput = dom.$.div(
					{ position$: "absolute", backgroundColor$: "gray", border$: "solid 1px silver" },
					canv,
					dom.$.div({ width$: "128px", float$: "left" },
						value_slider({ max: 255, value: 0 }),
						value_slider({ max: 255, value: 0 }),
						value_slider({ max: 255, value: 0 }),
						value_slider({ max: 255, value: 0, display$: "none" }),

					)
				);

				const ctx = canv.getContext("2d");
				const gradient = ctx.createLinearGradient(0, 0, canv.width, 0);
				gradient.addColorStop(0, "rgb(255,   0,   0)");
				gradient.addColorStop(0.15, "rgb(255,   0, 255)");
				gradient.addColorStop(0.33, "rgb(0,     0, 255)");
				gradient.addColorStop(0.49, "rgb(0,   255, 255)");
				gradient.addColorStop(0.67, "rgb(0,   255,   0)");
				gradient.addColorStop(0.84, "rgb(255, 255,   0)");
				gradient.addColorStop(1, "rgb(255,   0,   0)");
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, canv.width, canv.height);
				canv.multiplier = 1;



				const ranges = [];
				function update_color_value(spa, value, multiplier) {
					multiplier = multiplier || 1;
					spa.style.backgroundColor = "rgba("
						+ Math.floor((value[0] * multiplier)) + ","
						+ Math.floor((value[1] * multiplier)) + ","
						+ Math.floor((value[2] * multiplier)) + ","
						+ value[3] + ")";




					//console.log("update_color_value", [spa, value, spa.style.backgroundColor]);
					spa._value = value;

				};

				canv.onmousemove = canv.onmousedown = function (e) {
					if (e.buttons === 1) {
						const rect = canv.getBoundingClientRect();
						const x = (e.clientX - rect.left) | 0;
						const y = (e.clientY - rect.top) | 0;
						if (x > -1 && y > -1) {
							const rgba = ctx.getImageData(x, y, 1, 1).data;
							ranges[0].value = rgba[0];
							ranges[1].value = rgba[1];
							ranges[2].value = rgba[2];
							//ranges[0].oninput();
							//ranges[1].oninput();
							// ranges[2].oninput();
							canv.spa._value[0] = rgba[0] / canv.multiplier;
							canv.spa._value[1] = rgba[1] / canv.multiplier;
							canv.spa._value[2] = rgba[2] / canv.multiplier;

							update_color_value(canv.spa, canv.spa._value, canv.multiplier);
							canv.spa.dispatchEvent(_colorinput);

						}

					}
				};
				canv.update_value = function () {

				};
				cinput.querySelectorAll(".value_slider").forEach(function (r, i) {

					r.index = i;
					r.oninput = function (e) {
						if (this.index > 2)
							canv.spa._value[this.index] = this.value / 255;
						else
							canv.spa._value[this.index] = this.value / canv.multiplier;

						update_color_value(canv.spa, canv.spa._value, canv.multiplier);
						e.preventDefault();
						e.stopPropagation();
						canv.spa.dispatchEvent(_colorinput);
						return false;
					};
					ranges.push(r);

				});


				cinput.dismis = function () {
					this.style.display = "none";
					if (canv.spa) {
						if (canv.spa.ondismis) canv.spa.ondismis();
					}
				};

				cinput.bring_to_front = true;
				function show_selector(spa, multiplier) {

					canv.multiplier = multiplier || 1;

					console.log("canv.multiplier", canv.multiplier, spa.value);
					const rec = spa.getBoundingClientRect();
					dom.add_body(cinput);
					cinput.style.left = rec.left + "px";
					cinput.style.top = (rec.top + rec.height) + "px";


					const overlay = dom.get_overlay();

					overlay.show(cinput, true);




					ranges[0].value = (spa._value[0] * canv.multiplier) | 0;
					ranges[1].value = (spa._value[1] * canv.multiplier) | 0;
					ranges[2].value = (spa._value[2] * canv.multiplier) | 0;
					ranges[3].value = (spa._value[3] * 255) | 0;

					canv.backup[0] = ranges[0].value;
					canv.backup[1] = ranges[1].value;
					canv.backup[2] = ranges[2].value;
					canv.backup[3] = ranges[3].value;


					canv.spa = spa;
					//ranges[0].oninput();
					//ranges[1].oninput();
					//ranges[2].oninput();
					//ranges[3].oninput();

					return this;
				}

				canv.backup = [];

				const color_input = function () {
					const spa = dom.$.span({ $class: "color_input", width$: "100%", height$: "20px", display$: "block" });


					dom.def_props(spa, {
						value: [
							function set(value) {
								spa._value = value;
								update_color_value(spa, spa._value, spa.multiplier);

							},
							function get() {
								return spa._value;
							}

						]

					});

					dom.component(spa, arguments);

					spa._value = spa._value || new Float32Array([255, 255, 255, 255]);

					spa.multiplier = spa.multiplier || 1;

					spa.onmousedown = function (e) {
						show_selector(this, this.multiplier);
					};
					spa.show_selector = function () {
						show_selector(this, this.multiplier);
					};
					spa.update_color_value = update_color_value;
					return spa;
				}
				color_input.show_selector = show_selector;
				return color_input;
			})();

			dom.components["json_editor"] = (function () {
				dom.css(`
.json_editor_input  {position:absolute;font-size:14px;block-size:16px;margin-left:-4px;margin-top:-4px;margin:0;margin-left:-2px;background-color:gray;z-index:99999}
.json_editor_input > input {outline:0;   padding: 0px;padding-left:2px;color:black;}
.json_editor {display:block;margin-left:2px;overflow-x:hidden;pointer-events:fill;}
.json_editor .li{position:relative;margin:2px;width:100%;height:auto;cursor:pointer;}
.json_editor .li >.div {display:inline-block;user-select:none;padding-left:16px;border:solid 1px transparent;min-height:20px;padding-right:4px;}

.json_editor .li >.folder{margin-left:4px;}
.json_editor .li >.div.folder:hover {border:solid 1px gray;background:rgba(100,100,100,0.5);}
.json_editor .li >.folder::before{content:'+';position:absolute;left:10px;}
.json_editor .li.expanded2 >.div.folder.array:hover {padding-right:10px;}
.json_editor .li.disabled{background-color:gray !important;color:silver !important;}

.json_editor .li.expanded > .folder::before{content:'-';}
.json_editor .li >.ul {display: none !important;pointer-events:fill;margin-left:4px;padding:2px;}
.json_editor .li.expanded >.ul {display:inline-table !important;width:100%;}
.json_editor .li.expanded >.ul.array {border-top:solid 1px rgba(0,100,0,0.5);;}

.json_editor .li > .div.label{position:relative;border-bottom:solid 1px rgba(100,100,100,0.5);display:block;pointer-events:none;overflow:hidden;}
.json_editor .li > .div.label >.span{position:absolute;left:50%;width:auto;top:2px;min-width:100px;font-size:14px;block-size:16px;pointer-events:fill;}
`)

				const is_object = define.is_object;
				const is_function = define.is_function;

				const editor_input = dom.components["input_slide"]({ class$: "json_editor_input" });
				const checkbox_input = dom.$.checkbox({ $style: "position:absolute;margin-left:-4px;margin-top:-2px;z-index:999999;" });
				const select_input = dom.$.select({ $style: "position:absolute;margin-left:-4px;margin-top:0px;z-index:999999;" });
				const color_input = dom.$.color_input({
					position$: "absolute", width$: "24px", multiplier: 255,
					opacity$: 0,
					oninput: function () {
						this.fol.textContent = this._value;
						this.fol.style.backgroundColor = this.style.backgroundColor;
					}

				});


				color_input.component = function (editor, fol, key, prop, value) {
					fol.textContent = fol.prop;
					fol.classList.add("label");
					fol = create_div("span", value, fol);
					color_input.update_color_value(fol, value, 255);
					fol.onmousedown = function () {
						const rec = this.getBoundingClientRect();
						color_input.style.display = "unset";

						dom.add_body(color_input);
						color_input.style.left = (rec.left - 32) + "px";
						color_input.style.top = (rec.top + rec.height - 20) + "px";
						color_input.value = value;
						color_input.fol = fol;
						color_input.show_selector();
						fol.style.backgroundColor = color_input.style.backgroundColor;
						color_input.oninput = function () {
							this.fol.textContent = this._value;
							this.fol.style.backgroundColor = this.style.backgroundColor;
							editor.trigger_update(key, prop, this._value);
						}

					}
				};


				const action_button = dom.$.button("x", { $style: "position:absolute;padding: 0px 5px 1px 3px;font-size:70%;display:none;z-index:999999;" });

				dom.add_body(action_button);
				editor_input.last_elm = undefined;
				editor_input.update_elm = function (elm, value, display_value) {

					elm.obj_value = value;
					elm.textContent = display_value;
					const fol = elm.parentNode;
					const cont = fol.parentNode.parentNode;
					const edt = (cont.editor ? cont.editor : cont);
					const obj = edt.find_object(cont.key)

					if (obj) {
						//	console.log("obj", obj, [fol,elm]);
						obj[fol.prop] = elm.obj_value;
					}
					edt.trigger_update(cont.key, fol.prop, elm.obj_value);
				};

				checkbox_input.oninput = function (e) {

					if (this.elm) {
						editor_input.update_elm(this.elm, this.checked, this.checked);
					}
					return false;
				};

				select_input.oninput = function (e) {

					if (this.elm) {
						editor_input.update_elm(this.elm, this.value, this.value);
						editor_input.hide();
					}
					return false;
				};


				editor_input.show = function (elm, sch) {
					this.mode = sch.mode;
					if (sch.mode == "number") {
						this.inc = sch.inc;
						this.decimals = sch.decimals || 0;
						this.min = sch.min;
						this.max = sch.max;
					}
					else if (sch.mode == "select") {
						if (sch.options) {
							if (!sch._options) {
								sch._options = sch.options.map(function (op) {
									if (Array.isArray(op)) {
										return new Option(op[0], op[1]);
									}
									return new Option(op, op);

								});
							}

							if (sch._options) {
								select_input.options.length = 0;
								sch._options.forEach(function (op) {
									select_input.options.add(op);
								})
							}





						}


					}

					const rec = elm.getBoundingClientRect();
					let e = this;
					if (this.mode == "checkbox") {
						e = checkbox_input;
						e.checked = elm.obj_value;
					}
					else if (this.mode == "select") {
						e = select_input;

						e.value = elm.obj_value;
					}
					else {
						e.value = elm.textContent;
					}
					editor_input.last_input = e;
					e.style.display = "block";
					e.style.left = rec.left + "px";
					e.style.top = rec.top + "px";
					e.style.height = rec.height + "px";
					e.style.width = rec.width + "px";
					e.title = sch.title || sch.mode;
					e.elm = elm;

					dom.add_body(e);
				};

				editor_input.hide = function () {
					this.style.display = "none";
					action_button.style.display = "none";
					checkbox_input.style.display = "none";
					select_input.style.display = "none";

					if (this.last_input) {
						//editor_input.update_elm(this.last_input.elm, this.last_input.value, this.last_input.value);
					}
				};

				editor_input.oninput = function (e) {
					if (this.elm) {
						if (this.mode == "text") {
							editor_input.update_elm(this.elm, this.value, this.value);
						}
						else {
							editor_input.update_elm(this.elm, parseFloat(this.value), this.value);
						}

					}
					return false;
				};

				editor_input._input.onblur = function (e) {
					e.preventDefault();
					e.stopPropagation();
					editor_input.hide();
					return false;
				};

				const free_divs = [];
				const divs_holder = dom.elm("div");
				console.log([divs_holder, free_divs]);

				action_button.show_left = function (title, elm, onclick) {
					const btn = this;
					btn.innerHTML = title;
					const rec = elm.getBoundingClientRect();
					btn.style.display = "block";
					btn.style.left = (rec.left) + "px";
					btn.style.top = rec.top + "px";

					btn.style.marginLeft = (-(this.getBoundingClientRect().width * 0.5)) + "px";
					btn.elm = elm;


					btn.onclick = function (e) {
						btn.onclick = undefined;
						btn.style.display = "none";

						e.stopPropagation();
						e.preventDefault();
						onclick(btn);
						return false;
					};
				};

				action_button.show_right = function (title, elm, onclick) {
					const btn = this;
					btn.innerHTML = title;
					const rec = elm.getBoundingClientRect();
					btn.style.display = "block";
					btn.style.left = (rec.right) + "px";
					btn.style.top = (rec.top + 2) + "px";
					btn.style.marginLeft = "0";
					btn.elm = elm;

					btn.onclick = function (e) {
						btn.onclick = undefined;
						btn.style.display = "none";
						e.stopPropagation();
						e.preventDefault();
						onclick(btn);
						return false;

					};
				};

				function create_div(className, text, par) {
					let dv;
					if (free_divs.length > 0) {
						dv = free_divs.pop();
						dv.innerHTML = "";
					}
					else {
						dv = dom.elm("div");
					}
					dv.className = className;

					if (text !== undefined) dv.textContent = text;
					if (par) par.appendChild(dv);
					return dv;
				}

				const jeinput = dom.create_event("input", { bubbles: true });
				function editor() {
					const dv = create_div("json_editor");
					dv.free_div = function (d) {
						if (d) {
							if (d.classList.contains("json_editor_component")) return;
							delete this.objects_loaded[d.key];
							if (d.parentNode !== divs_holder) {
								free_divs.push(d);
								divs_holder.appendChild(d);
								delete d.key;
								delete d.prop;
								delete d.style.backgroundColor;
								if (d.props) {
									delete d.editor;
									delete d.props;
								}
							}

						}

					};
					const params = {};
					dv.on_update = dom.create_event("on_update", params);
					dv.on_update.params = {};
					dv.trigger_update = function (key, prop, value) {

						this.on_update.params.key = key;
						this.on_update.params.prop = prop;
						this.on_update.params.value = value;
						this.dispatchEvent(this.on_update);
						this.dispatchEvent(jeinput);
					};

					dv.create_div = create_div;
					dv.get_schema = function (key, value) {

						for (let i = 0; i < this.schema.length; i++) {
							if (this.schema[i][0].test(key)) return this.schema[i][1];
						}

						if (isNaN(value)) {
							if (value === true || value === false) {
								return "boolean";
							}

							return "text";
						}
						if (value === true || value === false) {
							return "boolean";
						}
						return "number";

					};

					dv.populate_value = function (key, value, parent, json_object) {

						const li = create_div("li", undefined, parent);
						let fol = create_div("div", key + "", li);

						fol.prop = key;
						li.prop = key;
						key = parent.key + '!!' + key;


						fol.key = key;

						if (ArrayBuffer.isView(value) || Array.isArray(value) || is_object(value)) {
							const comp = this.schema.defs[this.get_schema(key, value)];
							if (comp && is_function(comp)) {
								fol.classList.add("component");
								comp(this, fol, key, fol.prop, value);


							}
							else {
								fol.classList.add("folder");
								if (this.expand_all) {
									this.expand_folder(fol);
									fol.parentNode.classList.add("expanded");
								}

							}
						}
						else {
							fol.classList.add("label");

							fol = create_div("span", value, fol);
							fol.schema = this.get_schema(key, value);
							fol.obj_value = value;
						}

					}

					dv.find_object = function (key) {

						let obj = this.json;
						if (key == "___root") return obj;
						const keys = key.split("!!");
						for (let i = 1; i < keys.length; i++) {
							if (!obj) return obj;
							if (Array.isArray(obj)) {

								obj = obj[parseInt(keys[i])];
							}
							else obj = obj[keys[i]];
						}


						return obj;
					}

					dv.expand_value = function (value, parent, json_object) {
						const dv = this;
						if (ArrayBuffer.isView(value) || Array.isArray(value)) {
							parent.classList.add("array");
							value.forEach(function (value, i) {
								dv.populate_value(i, value, parent, json_object);
							});
						}
						else if (is_object(value)) {
							parent.props = parent.props || {};
							for (let k in value) {
								if (is_function(value[k])) continue;
								parent.props[k] = k;

								dv.populate_value(k, value[k], parent, json_object);
							}
						}
					};



					const removeables = [];
					dv.observe_values = function observe_values() {
						const dv = this;
						let i, obj, fol, ke, va, sch, ovalue;
						removeables.length = 0;

						for (ke in dv.objects_loaded) {
							ul = dv.objects_loaded[ke];
							obj = dv.find_object(ul.key);
							if (obj) {

								if (ArrayBuffer.isView(obj) || Array.isArray(obj)) {
									if (obj.length != ul.childNodes.length) {
										if (obj.length > ul.childNodes.length) {
											dv.populate_value(obj.length - 1, obj[obj.length - 1], ul, obj);
										}
										else {
											for (i = 0; i < ul.childNodes.length; i++) {
												removeables.push(ul.childNodes[i]);
											}
											for (i = 0; i < obj.length; i++) {
												dv.populate_value(i, obj[i], ul, obj);
											}
										}

									}
									else {
										for (i = 0; i < ul.childNodes.length; i++) {
											fol = ul.childNodes[i].firstChild;
											if (fol.classList.contains("label")) {
												sch = dv.schema.defs[fol.firstElementChild.schema];
												if (sch && sch.mode == "number") {
													va = parseFloat(obj[fol.prop]).toFixed(sch.decimals);
													va = Math.max(sch.min, va);
													va = Math.min(sch.max, va);
													fol.firstElementChild.textContent = va;

												}
												else fol.firstElementChild.textContent = obj[fol.prop];
												//console.log("fol.firstElementChild", [fol.firstElementChild]);
											}
										}
									}



								}
								else {

									for (i = 0; i < ul.childNodes.length; i++) {
										fol = ul.childNodes[i].firstChild;
										ovalue = obj[fol.prop];
										if (ovalue === undefined) {
											removeables.push(fol.parentNode);
										}
										else if (fol.classList.contains("label")) {
											if (fol.firstElementChild.obj_value !== ovalue) {
												fol.firstElementChild.obj_value = ovalue;
												fol.firstElementChild.textContent = fol.firstElementChild.obj_value;
											}
										}
									}
									for (i in obj) {
										if (is_function(obj[i])) continue;
										if (ul.props[i] === undefined) {
											dv.populate_value(i, obj[i], ul, obj);
										}
									}
								}
							}
							else removeables.push(ul.parentNode);
						}

						if (removeables.length > 0) {
							removeables.forEach(function (d) {
								d.querySelectorAll("div").forEach(function (d) {
									dv.free_div(d);
								});
								dv.free_div(d);
							});
						}
						window.PR.free_divs = dv.free_divs.length;

					};

					dv.expand_folder = function (folder) {
						if (!this.objects_loaded[folder.key + ""]) {

							const ul = create_div("ul");
							this.objects_loaded[folder.key + ""] = ul;
							ul.key = folder.key;
							ul.editor = this;
							folder.parentNode.appendChild(ul);
							const obj = this.find_object(ul.key);
							this.expand_value(obj, ul, obj);
						}

					}
					dv.onclick = function (e) {
						if (e.target.classList.contains("folder")) {
							this.expand_folder(e.target);
							e.target.parentNode.parentNode.querySelectorAll(".expanded").forEach(function (b) {
								//	b.classList.remove("expanded");
							});

							e.target.parentNode.classList.toggle("expanded");
						}
					};

					dv.delete_from_array = function (btn) {

						const idx = parseInt(btn.elm.prop);
						const ul = btn.elm.parentNode;
						const arr = dv.find_object(ul.key);
						if (dv.deleting_from_array && dv.deleting_from_array(ul.key, arr, idx) == false) return;
						btn.elm.classList.add("disabled");
						arr.splice(idx, 1);
					};

					dv.add_to_array = function (btn) {
						console.log([btn, btn.elm]);

						const ul = btn.elm.nextSibling;
						const arr = dv.find_object(ul.key);
						console.log([ul.key, arr]);
						if (dv.adding_to_array) dv.adding_to_array(ul.key, arr);
					};

					dv.onmousemove = function (e) {

						if (e.target.classList.contains("span")) {

							if (this.mouse_span !== e.target) {

								this.mouse_span = e.target;
								if (this.mouse_span.schema) {

									if (dv.schema.defs[this.mouse_span.schema]) {

										editor_input.show(e.target, dv.schema.defs[this.mouse_span.schema]);
									}
								}
							}

						}
						else {
							if (e.target.classList.contains("folder")) {
								if (e.target.parentNode.classList.contains("expanded")) {
									if (e.target.nextSibling.classList.contains("array")) {
										action_button.show_right("+ADD", e.target, dv.add_to_array);
										return;
									}

								}
							}
							else if (e.target.classList.contains("li")) {
								if (e.target.parentNode.classList.contains("array")) {
									//	action_button.show_left("X", e.target, dv.delete_from_array);
									return;
								}
							}

							editor_input.hide();
							this.mouse_span = undefined;

						}
					};


					dv.free_divs = free_divs;

					dv.set_json = function (json) {
						const dv = this;
						this.json = json;
						//console.log("json", json);
						this.key = "___root";
						this.objects_loaded = { "___root": dv };
						this.querySelectorAll("div").forEach(function (d) {
							dv.free_div(d);
						});
						this.expand_value(json, dv, json);
					};



					dv.schema = editor.default_schema;


					dom.component(dv, arguments);
					const value = dv.value;
					dom.def_props(dv, {
						value: [
							function (value) {
								dv.set_json(value);
							},
							function () {
								return dv.json;
							}
						],
					});

					//dv.set_json(value);
					console.log("dv", [dv]);
					return dv;
				}

				editor.tick = function () {
					document.querySelectorAll("div.json_editor").forEach(function (dv) {
						dv.observe_values();
					});
					setTimeout(editor.tick, 1000);
				};

				editor.tick();

				editor.create_schema = function (schemas) {
					const sch = [];
					sch.defs = {};
					if (editor.default_schema) {
						Object.assign(sch.defs, editor.default_schema.defs);
					}
					schemas.forEach(function (s) {
						if (s[0] instanceof RegExp) {
							if (!define.is_object(s[1])) {
								sch.push([s[0], s[1]])
							}
							else {
								let id = "schema" + Object.keys(sch.defs).length;
								sch.defs[id] = s[1];
								sch.push([s[0], id]);
							}

						}
						else {
							sch.defs[s[0]] = s[1];
						}
					});

					console.log("create_schema", sch);
					return sch;
				}



				editor.default_schema = editor.create_schema([
					["number", { min: -Infinity, max: Infinity, decimals: 5, inc: 0.01, mode: "number" }],
					["iangle", { mode: "number", min: -180, max: 180, inc: 1, decimals: 0 }],
					["angle", { mode: "number", min: -Math.PI, max: Math.PI, inc: Math.PI / 360, decimals: 4 }],
					["text", { mode: "text" }],
					["boolean", { mode: "checkbox" }],
					["color", color_input.component],
					[/\i@.*/, "iangle"],
					[/@.*/, "angle"],


				]);

				return editor;

			})();



		});

	});





	packing.register("binary_pack", function () {

		packing()("binary_pack", function () {
			/*
BPAK - minimal binary asset pack format.

Layout (all integers little-endian):
	[0]  4 bytes   magic "BPAK"
	[4]  uint16    version
	[6]  uint16    flags (reserved, 0)
	[8]  uint32    entry count
	[12] uint32    toc size in bytes (not including this 16-byte header)
	[16] ...       TOC: for each entry, in order:
									 uint16 nameLen
									 nameLen bytes  name (UTF-8)
									 uint32 dataOffset (relative to start of data section)
									 uint32 dataLength
	[16+tocSize]   data section: every entry's raw bytes, concatenated in TOC order

No per-entry compression or checksum - entries here are already-compressed
image formats (jpg/png/webp), so there is nothing to gain from deflating
them again, and skipping CRC computation keeps both write() and read() a
single linear pass. version/flags are reserved so a future revision (e.g.
optional per-entry checksum, or a compression flag) can be added without
breaking readers that only understand the fields they need.

Vanilla ES5 (var/function only, no let/const/arrow/template
literals/classes) so this file can be dropped as-is into a JS runtime
that doesn't support newer syntax. Uses ArrayBuffer/Uint8Array/DataView -
these are the standard binary primitives in JS engines and are what makes
read() zero-copy (subarray() is a view, not a copy).
*/

			/*
BPAK - minimal binary asset pack format.

Layout (all integers little-endian):
	[0]  4 bytes   magic "BPAK"
	[4]  uint16    version
	[6]  uint16    flags (reserved, 0)
	[8]  uint32    entry count
	[12] uint32    toc size in bytes (not including this 16-byte header)
	[16] ...       TOC: for each entry, in order:
									 uint16 nameLen
									 nameLen bytes  name (UTF-8)
									 uint32 dataOffset (relative to start of data section)
									 uint32 dataLength
	[16+tocSize]   data section: every entry's raw bytes, concatenated in TOC order

No per-entry compression or checksum - entries here are already-compressed
image formats (jpg/png/webp), so there is nothing to gain from deflating
them again, and skipping CRC computation keeps both write() and read() a
single linear pass. version/flags are reserved so a future revision (e.g.
optional per-entry checksum, or a compression flag) can be added without
breaking readers that only understand the fields they need.

Vanilla ES5 (var/function only, no let/const/arrow/template
literals/classes) so this file can be dropped as-is into a JS runtime
that doesn't support newer syntax. Uses ArrayBuffer/Uint8Array/DataView -
these are the standard binary primitives in JS engines and are what makes
read() zero-copy (subarray() is a view, not a copy).
*/
			const BPAK = (function () {
				'use strict';

				let MAGIC = [0x42, 0x50, 0x41, 0x4B]; // "BPAK"
				let VERSION = 1;
				let HEADER_SIZE = 16;

				function utf8Encode(str) {
					let bytes = [];
					let i, code, next, codepoint;
					for (i = 0; i < str.length; i++) {
						code = str.charCodeAt(i);
						if (code < 0x80) {
							bytes.push(code);
						} else if (code < 0x800) {
							bytes.push(0xC0 | (code >> 6));
							bytes.push(0x80 | (code & 0x3F));
						} else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
							next = str.charCodeAt(i + 1);
							codepoint = ((code - 0xD800) << 10) + (next - 0xDC00) + 0x10000;
							i += 1;
							bytes.push(0xF0 | (codepoint >> 18));
							bytes.push(0x80 | ((codepoint >> 12) & 0x3F));
							bytes.push(0x80 | ((codepoint >> 6) & 0x3F));
							bytes.push(0x80 | (codepoint & 0x3F));
						} else {
							bytes.push(0xE0 | (code >> 12));
							bytes.push(0x80 | ((code >> 6) & 0x3F));
							bytes.push(0x80 | (code & 0x3F));
						}
					}
					return bytes;
				}

				function utf8Decode(bytes, offset, length) {
					let out = '';
					let end = offset + length;
					let i = offset;
					let b0, c1, c2, cp;
					while (i < end) {
						b0 = bytes[i];
						if (b0 < 0x80) {
							out += String.fromCharCode(b0);
							i += 1;
						} else if ((b0 & 0xE0) === 0xC0) {
							c1 = ((b0 & 0x1F) << 6) | (bytes[i + 1] & 0x3F);
							out += String.fromCharCode(c1);
							i += 2;
						} else if ((b0 & 0xF0) === 0xE0) {
							c2 = ((b0 & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F);
							out += String.fromCharCode(c2);
							i += 3;
						} else {
							cp = ((b0 & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F);
							cp -= 0x10000;
							out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
							i += 4;
						}
					}
					return out;
				}

				// files: array of {name: string, data: Uint8Array}. Returns a Uint8Array.
				function write(files) {
					let count = files.length;
					let i, n;
					let nameByteArrays = new Array(count);
					let tocSize = 0;

					for (i = 0; i < count; i++) {
						let nameBytes = utf8Encode(files[i].name);
						nameByteArrays[i] = nameBytes;
						tocSize += 2 + nameBytes.length + 4 + 4;
					}

					let dataSize = 0;
					for (i = 0; i < count; i++) {
						dataSize += files[i].data.length;
					}

					let totalSize = HEADER_SIZE + tocSize + dataSize;
					let buffer = new ArrayBuffer(totalSize);
					let bytes = new Uint8Array(buffer);
					let view = new DataView(buffer);

					bytes[0] = MAGIC[0];
					bytes[1] = MAGIC[1];
					bytes[2] = MAGIC[2];
					bytes[3] = MAGIC[3];
					view.setUint16(4, VERSION, true);
					view.setUint16(6, 0, true);
					view.setUint32(8, count, true);
					view.setUint32(12, tocSize, true);

					let tocPos = HEADER_SIZE;
					let dataSectionStart = HEADER_SIZE + tocSize;
					let dataCursor = 0;

					for (i = 0; i < count; i++) {
						let nb = nameByteArrays[i];
						view.setUint16(tocPos, nb.length, true);
						tocPos += 2;
						for (n = 0; n < nb.length; n++) {
							bytes[tocPos + n] = nb[n];
						}
						tocPos += nb.length;

						let entryData = files[i].data;
						view.setUint32(tocPos, dataCursor, true);
						tocPos += 4;
						view.setUint32(tocPos, entryData.length, true);
						tocPos += 4;

						bytes.set(entryData, dataSectionStart + dataCursor);
						dataCursor += entryData.length;
					}

					return bytes;
				}

				// buffer: ArrayBuffer or Uint8Array. Returns {get(name), list(), count, version}.
				// get() returns a zero-copy Uint8Array view into the original buffer, or null.
				function read(buffer) {
					let bytes = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
					let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

					if (bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1] || bytes[2] !== MAGIC[2] || bytes[3] !== MAGIC[3]) {
						throw new Error('BPAK: bad magic');
					}
					let version = view.getUint16(4, true);
					if (version !== VERSION) {
						throw new Error('BPAK: unsupported version ' + version);
					}
					let count = view.getUint32(8, true);
					let tocSize = view.getUint32(12, true);
					let dataSectionStart = HEADER_SIZE + tocSize;

					let index = {};
					let order = new Array(count);
					let pos = HEADER_SIZE;
					let i, nameLen, name, offset, length, entry;

					for (i = 0; i < count; i++) {
						nameLen = view.getUint16(pos, true);
						pos += 2;
						name = utf8Decode(bytes, pos, nameLen);
						pos += nameLen;
						offset = view.getUint32(pos, true);
						pos += 4;
						length = view.getUint32(pos, true);
						pos += 4;

						entry = { name: name, offset: offset, length: length };
						index[name] = entry;
						order[i] = entry;
					}

					function get(name) {
						let e = index[name];
						if (!e) return null;
						return bytes.subarray(dataSectionStart + e.offset, dataSectionStart + e.offset + e.length);
					}

					function list() {
						let names = new Array(order.length);
						for (let j = 0; j < order.length; j++) {
							names[j] = order[j].name;
						}
						return names;
					}

					return { get: get, list: list, count: count, version: version };
				}

				// Folders are not a format feature - an entry name is just a '/'-separated
				// path (same convention as zip/tar). buildTree() turns a flat name list
				// into a nested {type:'dir'|'file', ...} tree so callers (a viewer, an
				// engine's asset browser) don't each reimplement path splitting. An entry
				// whose name ends in '/' is an explicit empty-directory marker (usually
				// zero-length data) rather than a file leaf.
				function buildTree(names) {
					let root = { type: 'dir', name: '', path: '', children: {} };
					let i, raw, isDirMarker, parts, node, pathSoFar, p, part, isLastPart;

					for (i = 0; i < names.length; i++) {
						raw = names[i];
						isDirMarker = raw.charAt(raw.length - 1) === '/';
						parts = raw.split('/');
						if (isDirMarker) {
							parts.pop();
						}

						node = root;
						pathSoFar = '';
						for (p = 0; p < parts.length; p++) {
							part = parts[p];
							if (part === '') continue;
							pathSoFar = pathSoFar ? pathSoFar + '/' + part : part;
							isLastPart = (p === parts.length - 1);

							if (isLastPart && !isDirMarker) {
								node.children[part] = { type: 'file', name: part, path: pathSoFar, fullName: raw };
							} else {
								if (!node.children[part] || node.children[part].type !== 'dir') {
									node.children[part] = { type: 'dir', name: part, path: pathSoFar, children: {} };
								}
								node = node.children[part];
							}
						}
					}
					return root;
				}

				// Mutable pack: add/remove entries, then build() into pack bytes.
				// fromPack()/fromBuffer() seed a Builder from an existing pack so it can
				// be edited and re-saved without touching entries you don't change -
				// seeded entries are the zero-copy views read() already returned, so
				// nothing is copied until build() assembles the final buffer.
				function Builder() {
					this._entries = {};
					this._order = [];
				}

				Builder.prototype.add = function (name, data) {
					if (!Object.prototype.hasOwnProperty.call(this._entries, name)) {
						this._order.push(name);
					}
					this._entries[name] = data;
				};

				Builder.prototype.remove = function (name) {
					if (Object.prototype.hasOwnProperty.call(this._entries, name)) {
						delete this._entries[name];
						let idx = this._order.indexOf(name);
						if (idx !== -1) this._order.splice(idx, 1);
						return true;
					}
					return false;
				};

				// Removes name itself plus every entry under it as a folder (name + '/' prefix).
				// Returns the list of removed names.
				Builder.prototype.removeTree = function (name) {
					let prefix = name.charAt(name.length - 1) === '/' ? name : name + '/';
					let removed = [];
					let names = this.list();
					for (let i = 0; i < names.length; i++) {
						let n = names[i];
						if (n === name || n === prefix || n.indexOf(prefix) === 0) {
							this.remove(n);
							removed.push(n);
						}
					}
					return removed;
				};

				Builder.prototype.has = function (name) {
					return Object.prototype.hasOwnProperty.call(this._entries, name);
				};

				Builder.prototype.get = function (name) {
					return this.has(name) ? this._entries[name] : null;
				};

				Builder.prototype.list = function () {
					return this._order.slice();
				};

				Builder.prototype.build = function () {
					let files = new Array(this._order.length);
					for (let i = 0; i < this._order.length; i++) {
						files[i] = { name: this._order[i], data: this._entries[this._order[i]] };
					}
					return write(files);
				};

				Builder.fromPack = function (pack) {
					let b = new Builder();
					let names = pack.list();
					for (let i = 0; i < names.length; i++) {
						b.add(names[i], pack.get(names[i]));
					}
					return b;
				};

				Builder.fromBuffer = function (buffer) {
					return Builder.fromPack(read(buffer));
				};

				return { write: write, read: read, buildTree: buildTree, Builder: Builder, VERSION: VERSION };
			})();


			Object.assign(this, BPAK);
			return this;

		});
	});


	packing.register("json_bin", function () {

		packing()("json_bin", function () {
			const bag = (function () {


				const str_uint8 = (function () {
					const lenu32 = new Uint16Array(1);
					const lenu8 = new Uint8Array(lenu32.buffer);
					return function (str, store_length) {
						let arr, i = 0;

						if (store_length) {
							lenu32[0] = str.length;
							arr = new Uint8Array(str.length + 2);
							arr[i++] = lenu8[0];
							arr[i++] = lenu8[1];
						}
						else {
							arr = new Uint8Array(str.length);
						}
						while (i < str.length) {
							arr[i] = str.charCodeAt(i++);
						}

						return arr;
					};

				})();


				let bi = 0, spoi, rsize, buffer = new Uint8Array(2);
				let buffer_orig = buffer, data_length = 0;

				const pointer = new Uint32Array(1);
				const pointer_bytes = new Uint8Array(pointer.buffer);
				function add_pointer(value) {
					const poi = bi;
					pointer[0] = value;
					buffer[bi++] = pointer_bytes[0];
					buffer[bi++] = pointer_bytes[1];
					buffer[bi++] = pointer_bytes[2];
					buffer[bi++] = pointer_bytes[3];


					return poi;
				}
				function set_pointer(poi, value) {
					pointer[0] = value;
					buffer[poi++] = pointer_bytes[0];
					buffer[poi++] = pointer_bytes[1];
					buffer[poi++] = pointer_bytes[2];
					buffer[poi++] = pointer_bytes[3];
				}
				function get_pointer(poi) {
					pointer_bytes[0] = buffer[poi++];
					pointer_bytes[1] = buffer[poi++];
					pointer_bytes[2] = buffer[poi++];
					pointer_bytes[3] = buffer[poi++];
					return pointer[0];
				}

				function read_text(poi) {
					return uint8_str(new Uint8Array(buffer.buffer, poi + 4, get_pointer(poi)));
				};

				function read_uint8(poi) {
					const arr = new Uint8Array(get_pointer(poi));
					arr.set(new Uint8Array(buffer.buffer, poi + 4, arr.length));
					return arr

				};

				function read_float32(poi) {
					return new Float32Array(read_uint8(poi).buffer);
				};
				const uint8_str = function (arr) {
					let m = "";
					for (let i = 0; i < arr.length; i++) {
						m += String.fromCharCode(arr[i]);
					}
					return m;
				};


				function add_data(data, length) {
					data = new Uint8Array(data);
					data_length = length || data.length;
					const poi = add_pointer(data_length);
					for (let i = 0; i < data_length; i++)
						buffer[bi++] = data[i];
					return poi;
				}
				const bag = {};


				bag.data_length = function () {
					return data_length;
				};

				bag.read_uint8 = read_uint8;
				bag.read_text = read_text;
				bag.read_float32 = read_float32;

				bag.load_bin = function (buff) {
					buffer = buff;
					spoi = get_pointer(0);
					console.log("size", (buffer.length / 1024 / 1024).toFixed(2) + " mb");
					return this;
				};


				bag.create_loader = function (buff) {

					if (Object.prototype.toString.call(buff) === "[object String]") {
						buff = str_uint8(atob(buff)).buffer;
					}

					const bag = {};
					let buffer, spoi = 0, offset = 0;

					bag.load_buffer = function (buff) {
						buffer = new Uint8Array(buff);
						spoi = 0;
						offset = 0;
						if (buffer[0] == 255 && buffer[1] == 216 && buffer[2] == 255 && buffer[3] == 224) {
							pointer_bytes[0] = buffer[buffer.length - 4];
							pointer_bytes[1] = buffer[buffer.length - 3];
							pointer_bytes[2] = buffer[buffer.length - 2];
							pointer_bytes[3] = buffer[buffer.length - 1];
							offset = pointer[0];
							//spoi = offset;
							console.log(offset, pointer_bytes);

						}

						spoi = get_pointer(offset);
					};



					function get_pointer(poi) {
						pointer_bytes[0] = buffer[poi++];
						pointer_bytes[1] = buffer[poi++];
						pointer_bytes[2] = buffer[poi++];
						pointer_bytes[3] = buffer[poi++];
						return pointer[0];
					}



					function read_text(poi) {
						poi += offset;
						return uint8_str(new Uint8Array(buffer.buffer, poi + 4, get_pointer(poi)));
					};


					function read_uint8(poi) {
						poi += offset;
						const arr = new Uint8Array(get_pointer(poi));
						arr.set(new Uint8Array(buffer.buffer, poi + 4, arr.length));
						return arr;
					};

					function read_float32(poi) {
						poi += offset;
						return new Float32Array(buffer.buffer, poi + 4, get_pointer(poi) / 4);
						//return new Float32Array(read_uint8(poi).buffer);
					};

					function read_uint32(poi) {
						poi += offset;
						return new Uint32Array(buffer.buffer, poi + 4, get_pointer(poi) / 4);
					};

					function read_uint16(poi) {
						poi += offset;
						return new Uint16Array(buffer.buffer, poi + 4, get_pointer(poi) / 2);
					};

					bag.read_uint8 = read_uint8;
					bag.read_text = read_text;
					bag.read_uint16 = read_uint16;
					bag.read_uint32 = read_uint32;
					bag.read_float32 = read_float32;

					bag.read_info_json = function () {
						return JSON.parse(decodeURIComponent(read_text(spoi)));
					};

					if (buff) bag.load_buffer(buff);
					return bag;

				};
				bag.create_loader_function = function (buff) {
					const bag = this.create_loader(buff);
					const J = bag.read_info_json();
					return function (func) {
						return func(J, bag);
					}
				};


				bag.read_info_json = function () {
					return JSON.parse(decodeURIComponent(read_text(spoi)));
				};

				bag.add_data = function (data, length) {
					return add_data(data, length);
				};

				bag.add_info_json = function (info) {
					set_pointer(spoi, add_data(str_uint8(encodeURIComponent(JSON.stringify(info)))));
					return this;
				};

				bag.get_bin = function (pad) {
					return new Uint8Array(buffer.buffer, 0, bi + (bi % (pad || 1)));
				};

				bag.get_blob_with_thumb = function (pad, thumb) {
					thumb = new Uint8Array(thumb);
					pointer[0] = thumb.length;
					console.log("thumb.length", thumb.length);
					const b = new Blob([
						thumb,
						new Uint8Array(buffer.buffer, 0, bi + (bi % (pad || 1))),
						pointer_bytes
					], { type: "image/jpeg" }
					);
					console.log(b);
					return b;
				};

				bag.get_bin_base64 = function (pad) {
					return btoa(uint8_str(new Uint8Array(buffer.buffer, 0, bi + (bi % (pad || 1)))));

				};

				bag.allocate = function (size) {
					bi = 0;
					if (buffer.length < size) {
						buffer = new Uint8Array(size);
					}
					spoi = add_pointer(0);

					return this;
				};

				return bag;




			})();

			return bag;

		});

	});

	return packing;
}



let packing;
if (is_browser) {
	packing = create_packing("");
	console.log("packing", [packing]);
}
else {

	function sleep(ms) {
		return new Promise(function (resolve) { setTimeout(resolve, ms) });
	}
	const is_function = function (obj) {
		return !!(obj && obj.constructor && obj.call && obj.apply);
	};
	const fs = require('fs');
	const child_process = require("child_process");

	const get_bundle = async function (b) {
		if (b.get_bundle) {
			b = await b.get_bundle();
			return b;
		}
		else if (is_function(b)) {
			b = b.toString();
			return b.substr(b.indexOf("{") + 1, (b.length - b.indexOf("{")) - 2).trim();
		}
	}

	function args() {
		if (!process.argv) return {};
		let col = {};
		process.argv.forEach(function (a, i) {
			if (a.charAt(0) === '-') {
				const nx = process.argv[i + 1];
				col[a.substr(1, a.length)] = (nx === undefined || nx.charAt(0) === "-") ? "" : nx;       // (a flag has no value, or the next word that is not a flag)
			}
		});

		return col;

	};

	let A = args();
	console.log(A);

	let root = process.cwd();

	if (A["root"]) root = A["root"];

	if (A["serve"] !== undefined) {
		globalThis.packing_cli = { serve: A["serve"], port: A["port"], host: A["host"], root: root };
		packing = create_packing(root);
		packing("http.basic_server")(function (http) {
			http.basic_server(globalThis.packing_cli.serve, globalThis.packing_cli);
			return this;
		}).execute_bundle().then(function (bundle) { });
	}
	else if (A["run"]) {
		packing = create_packing(root);
		eval(require("fs").readFileSync(A["run"], 'utf8'));
	}

	else if (A["bundle"]) {
		const get_bundle = async function (b) {

			if (b.get_bundle) {

				b = await b.get_bundle();
				return b;
			}
			else if (is_function(b)) {
				b = b.toString();
				return b.substr(b.indexOf("{") + 1, (b.length - b.indexOf("{")) - 2).trim();
			}
		}
		const fil = A["bundle"];
		const fs = require("fs");
		packing = create_packing(root);
		get_bundle(eval(fs.readFileSync(fil, 'utf8'))).then(function (b) {
			fs.writeFileSync(fil + ".bndl.js", b);
		});
	}
}

if (typeof exports !== 'undefined') {
	exports.packing = create_packing;
}