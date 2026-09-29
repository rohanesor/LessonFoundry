-- Migration 005: Classrooms and membership.
BEGIN;

CREATE TABLE IF NOT EXISTS classrooms (
    id          VARCHAR(36) NOT NULL PRIMARY KEY,
    owner_id    VARCHAR(36) NOT NULL REFERENCES users(id),
    name        VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    join_code   VARCHAR(10) NOT NULL UNIQUE,
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at  VARCHAR NOT NULL,
    updated_at  VARCHAR NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_classrooms_owner_id ON classrooms(owner_id);
CREATE INDEX IF NOT EXISTS ix_classrooms_join_code ON classrooms(join_code);

CREATE TABLE IF NOT EXISTS classroom_members (
    id            VARCHAR(36) NOT NULL PRIMARY KEY,
    classroom_id  VARCHAR(36) NOT NULL REFERENCES classrooms(id),
    user_id       VARCHAR(36) NOT NULL REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    joined_at     VARCHAR NOT NULL,
    UNIQUE (classroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_classroom_members_classroom ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS ix_classroom_members_user ON classroom_members(user_id);

COMMIT;
