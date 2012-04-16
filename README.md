Dish
====

wat do
------

Dish.js is a small templating library that mimics Django templates (to a point).
It compiles templates into JavaScript functions, which makes them pretty snappy:

    test compilation: 10000 calls in 474 msec == 0.0474 msec/call == 21097 calls/s
    test run: 10000 calls in 55 msec == 0.0055 msec/call == 181818 calls/s

how do
------

### Using Dish

Once Dish.js is included in your page (it's also CommonJS Modules compatible, for you Node folks out there), simply

    var template = Dish.compile("Hello, {% if name %}{{ name }}{% else %}anonymous{% endif %}!");
    var text = template({"name": "person"});

HTML autoescaping is on by default. Suffixing a variable expression with ! turns HTML autoescaping off for it:

    var template = Dish.compile("This won't be mangled: {{ html! }} but this will: {{ html }}");
    var text = template({"html": "<b>taggy</b>"});

Expressions get compiled down to plain JavaScript, so you're expected to know what you're doing.

    var template = Dish.compile("Let's all {{ interjection.toUpperCase() }}!");
    var text = template({"interjection": "shout"});

There's a handful of basic blocks available too. These, too, are just plain JavaScript in the end.
You already saw if/else/endif above. if/elif/else/endif also exists, and two flavors of loops.

Array loops are fori:

    var template = Dish.compile("<h1>My favorite colors</h1>{% fori colors color %}{{ color }}<br>{% /for %}");
    var text = template({"colors": ["red", "orange", "light goldenrod yellow"]});

Numeric loops are forn:

    var template = Dish.compile("<h1>My favorite numbers</h1>{% forn number 1 6 %}{{ number }}<br>{% endfor %}");
    var text = template();

For loops can be ended with either `/for` or `endfor`. (The same goes for if: `/if` and `endif` both work.)

### Extending Dish

You can add your own blocks by defining them in the Dish.Blocks object.
Since everything is Javascript, let's add a block that'll let us use the `debugger;` literal:

    Dish.Blocks["debugger"] = function(content, env) {
        // content.args would be the rest of the block tag after the block name,
        // and content.argsArr the space-split array of the same, for convenience.
        // env.emit will emit the given Javascript into the output function stream,
        // env.enter("block-tag", "javascript") will push a block onto the current block stack and emit the given JS
        // env.exit("block-tag", "javascript") will pop a block from the block stack (if the closest pushed block matches the block-tag) and emit the given JS.
        env.emit("debugger;")
    }


