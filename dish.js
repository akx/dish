/**

         88  88             88                
         88  ""             88                
         88                 88                
 ,adPPYb,88  88  ,adPPYba,  88,dPPYba,        
a8"    `Y88  88  I8[    ""  88P'    "8a       
8b       88  88   `"Y8ba,   88       88       
"8a,   ,d88  88  aa    ]8I  88       88  888  
 `"8bbdP"Y8  88  `"YbbdP"'  88       88  888
 
Teensy weensy templating engine for JavaScript.
Built with love by Aarni Koskela at Anders Inno.
License: http://www.opensource.org/licenses/MIT

**/

var Dish = (function() {
	var b_re_src = "\\{(%(.+?)%|\\{(.+?)\\})\\}";
	
	function trim(s) {
		return ("" + s).replace(/^\s+|\s+$/g, '');
	}
	
	function escapeJS(s) {
		return JSON.stringify(s.toString());
	}
	
	function massageExpr(expr, options) {
		if(options.atSignThis) expr = expr.replace(/@/g, "this.");
		return expr;
	}
	
	function extend() {
		var target = arguments[0];
		for(var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for(var k in source) target[k] = source[k];
		}
		return target;
	}	
	
	
	var F = {};
	var Blocks = {};

	// Literal
	Blocks["!"] = function(c, e) {
		e.emit(c.args);
	};

	
	// If
	
	Blocks["if"] = function(c, e) {
		e.enter("if", "if(" + c.args + ") {");
	};

	Blocks["elif"] = function(c, e) {
		e.exit("if", "}");
		e.enter("if", "else if(" + c.args + ") {");
	};

	Blocks["else"] = function(c, e) {
		e.exit("if", "}");
		e.enter("if", "else {");
	};

	Blocks["endif"] = Blocks["/if"] = function(c, e) {
		e.exit("if", "}");
	};
	
	// For
	
	Blocks["fori"] = function(c, e) {
		/*
			syntax: {% fori <source> <object_var> <counter_var> %}...{% /for %}
		*/
		var source = massageExpr(c.argsArr[0], e.options);
		var objVar = c.argsArr[1];
		var counterName = c.argsArr[2] || ("_C" + c.i);
		var lenVarName = "_L" + c.i;
		e.emit("var " + lenVarName + " = (" + source + " || []).length;");
		e.enter("for", "for(var " + counterName + " = 0; " + counterName + " < " + lenVarName + "; " + counterName + "++) {");
		e.emit("var " + objVar + " = " + source + "[" + counterName + "];");
	};
	
	Blocks["forn"] = function(c, e) {
		/*
			syntax: {% forn <counter_var> <start> <stop> [<step>] %}...{% /for %}
		*/
		var counterVar = c.argsArr[0];
		var startVal = c.argsArr[1] || "0";
		var stopVal = c.argsArr[2] || "0";
		var stepVal = c.argsArr[3] || "1";
		
		e.enter("for", "for(var " + counterVar + " = " + startVal +"; " + counterVar + " < " + stopVal + "; " + counterVar + " += " + stepVal + ") {");
	};
	
	
	Blocks["endfor"] = Blocks["/for"] = function(c, e) {
		e.exit("for", "}");
	};

	
	
	
	function tokenize(tpl, options) {
		var stream = [];
		var b_re = new RegExp(b_re_src, "g");
		var last = 0;
		var m;
		trimLiterals = !!options.trimLiterals;
		
		function extractLiteral(start, end) {
			var literal = tpl.substring(start, end);
			if(trimLiterals) literal = trim(literal);
			if(literal.length) stream.push({"literal": literal});
		}
		
		while(!!(m = b_re.exec(tpl))) {
			extractLiteral(last, m.index);
			last = b_re.lastIndex;
			if(!!m[2]) { // control structure
				var args = trim(m[2]).split(" ");
				var verb = args.shift().toLowerCase();
				var argsStr = massageExpr(args.join(" "), options);
				stream.push({"control": verb, "args": argsStr, "argsArr": args});
				continue;
			}
			if(!!m[3]) { // content structure
				var cont = trim(m[3]);
				var noEscape = false;
				if(cont.charAt(cont.length - 1) == "!") {
					noEscape = true;
					cont = cont.substring(0, cont.length - 1);
				}
				cont = massageExpr(cont, options);
				try {
					var _func = new Function(cont);
				} catch(e) {
					throw "Compile error in " + m[0] + ": " + e;	
				}
				
					
				stream.push({"content": cont, "suffix": "", "prefix": "", "noEscape": noEscape});
				continue;
			}
		}
		extractLiteral(last, tpl.length);
		
		return stream;
	}
	
	function optimize(stream) {
		for(var i = 0; i < stream.length; i++) {
			var lit = stream[i].literal;
			var next = stream[i + 1];
			var prev = stream[i - 1];
			if(lit) {
				if(next && next.content) { // current literal, next content
					next.prefix = lit + next.prefix;
					stream.splice(i, 1);
					i --;
					continue;
				}
				if(prev && prev.content) { // current literal, last content
					prev.suffix = prev.suffix + lit;
					stream.splice(i, 1);
					i --;
					continue;
				}
			}
		}
		return stream;
	}

	
	function mogrify(stream, options) {
		var func_body = [];
		var C;
		var autoescape = !!options.autoescape;
		var autoescapeNeeded = false;
		var block_stack = [];
		
		if(stream.length == 1 && stream[0].literal) { // Quick path for entirely static templates
			return 'return ' + escapeJS(stream[0].literal) + ';';
		}
		
		
		
		function emit(line) {
			var indent = new Array(block_stack.length + 1).join("\t");
			func_body.push(indent + line);
		}
		
		function enter(block, line) {
			if(!!line) emit(line);
			block_stack.push(block);
		}
		
		function exit(block, line) {
			var curr = block_stack[block_stack.length - 1];
			if(curr != block) throw "Block pairing error while exiting " + block + " -- should be exiting " + curr;
			block_stack.pop();
			if(!!line) emit(line);
		}
		
		var E = {
			options:	options,
			emit:		emit,
			enter:		enter,
			exit:		exit
		};
		
		enter("_dish_with_", "with(_scope_) {");
		
		for(var i = 0; i < stream.length; i++) {
			var c = stream[i];
			if(c.literal) {
				emit("$O(" + escapeJS(c.literal) + ");");
				continue;
			}
			if(c.content) {
				var inner = c.content;
				inner = (((autoescape && !c.noEscape) ? (autoescapeNeeded = true, "$E") : "") + "(" + inner + ")");
				if(c.prefix.length) inner = escapeJS(c.prefix) + " + " + inner;
				if(c.suffix.length) inner = inner + " + " + escapeJS(c.suffix);
				emit("$O(" + inner + ");");
				continue;
			}
			if(!!(C = c.control)) {
				handler = Blocks[C];
				if(handler) {
					c.i = i;
					handler(c, E);
					continue;
				}
			}
			throw "Unknown stream element (" + c + ")";
		}
		exit("_dish_with_", "}");
		if(block_stack.length > 0) {
			throw "Block stack still has [" + block_stack.join("; ") + "] upon compilation end!";
		}
		
		var func_prelude = [
			"var $OB = [];",
			"var $O = function() { $OB.push.apply($OB, arguments); };"
		];
		if(autoescapeNeeded) func_prelude.push("var $E = function(s) { return (''+s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };");
		
		out = func_prelude.concat(func_body);
		out.push("return $OB.join('');");
		return out.join("\n");
		
	}

	
	
	var defaults = {
		"autoescape":		true,
		"optimize":			true,
		"trimLiterals":		false,
		"atSignThis":		false
	};

	
	
	function compile(source, options) {
		options = extend({}, defaults, options);
		if(typeof source.text === "function") source = source.text(); // jQuery compatibility.
		var stream = tokenize(source, options);
		if(options["optimize"]) optimize(stream);
		var js = mogrify(stream, options["autoescape"]);
		var templateFunc = new Function("_scope_", "F", js);
		return function(scope, self) {
			if(arguments.length > 1) { // If passed multiple arguments, create a scope by extending them from right to left
				scope = extend.apply(null, [].concat.apply({}, arguments));
			}
			return templateFunc.call(self || scope, scope, F);
		};
	};	

	return {
		compile:	compile,
		internals:	{
			tokenize:	tokenize,
			optimize:	optimize,
			mogrify:	mogrify
		},
		Blocks:		Blocks,
		F:			F
	};
}());

if (typeof exports !== 'undefined') {
	exports.Dish = Dish;
}