Dish
====

wat do
------

Dish.js is a small templating library that mimics Django templates (to a point).

how do
------

### Using Dish

Once Dish.js is included in your page (it's also CommonJS Modules compatible, for you Node folks out there), simply

    var template = Dish.compile("Hello, {% if name %}")