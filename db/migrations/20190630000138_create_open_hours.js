exports.up = function(knex, Promise) {
  return knex.schema.createTable("open_hours", (table) => {
    table.integer('restaurant_id');
    table.string('sunday');
    table.string('monday');
    table.string('tuesday');
    table.string('wednesday');
    table.string('thursday');
    table.string('friday');
    table.string('saturday');
    table.primary('restaurant_id');
    table.foreign('restaurant_id').references('restaurants.restaurant_id').onDelete('cascade');
  })
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('open_hours');
};