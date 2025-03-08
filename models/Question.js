const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Question = sequelize.define('Question', {
  question: {
    type: DataTypes.STRING,
    allowNull: false
  },
  options: {
    type: DataTypes.JSON,
    allowNull: false
  },
  answer: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

Question.belongsTo(User, { as: 'createdBy', foreignKey: 'userId' });

module.exports = Question;
