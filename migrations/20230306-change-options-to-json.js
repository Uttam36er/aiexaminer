"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Questions', {
      type: Sequelize.JSON,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Questions', {
      type: Sequelize.TEXT,
      allowNull: false
    });
  }
};