/*
 *  Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 *  This file (authFarmId.js) is part of LiteFarm.
 *
 *  LiteFarm is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  LiteFarm is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details, see <https://www.gnu.org/licenses/>.
 */

const userFarmModel = require('../../models/userFarmModel');

const adminRoles = [1, 2, 5];

async function validateAssigneeId(req, res, next) {
  const { user_id } = req.user;
  const { farm_id } = req.headers;
  const { assignee_user_id } = req.body;
  if (!adminRoles.includes(req.role) && user_id !== assignee_user_id && assignee_user_id !== null) {
    return res.status(403).send('Not authorized to assign other people for this task');
  }

  // if the assignee_user_id is null, this means that the task is 'Unassigned' which is a valid
  if (assignee_user_id === null) {
    return next();
  }

  const userFarm = await userFarmModel
    .query()
    .where({
      user_id: assignee_user_id,
      farm_id,
    })
    .whereIn('status', ['Active', 'Invited']);
  if (!userFarm?.length) {
    return res.status(400).send('Assignee does not have access to the farm');
  }
  return next();
}

module.exports = validateAssigneeId;
