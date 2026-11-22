package org.openbrod.migace;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLWarning;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Logger;
import javax.sql.DataSource;

/**
 * Runs a migration script of MIG-Ace.
 *
 * <p>All logic of a migration is in the script. This library sends it to the database, one statement
 * at a time, stops at the first error and passes the notices of the database on.
 *
 * <pre>
 * MigAce.execFromJar(BookshopApp.class, "/migace/migration-script-pg.sql", dataSource);
 * </pre>
 */
public final class MigAce {

    private static final Logger LOG = Logger.getLogger(MigAce.class.getName());

    private final String script;
    private final Map<String, String> parameters = new LinkedHashMap<>();
    private NoticeListener listener = LOG::info;

    private MigAce(String script) {
        this.script = script;
    }

    /** Reads the script from a resource of the JAR that holds the given class, and runs it on a connection of the data source. */
    public static void execFromJar(Class<?> classOfTheJar, String resource, DataSource dataSource) {
        fromJar(classOfTheJar, resource).exec(dataSource);
    }

    /** Reads the script from a resource of the JAR that holds the given class, and runs it on the connection. */
    public static void execFromJar(Class<?> classOfTheJar, String resource, Connection connection) {
        fromJar(classOfTheJar, resource).exec(connection);
    }

    /** A script from a resource of the JAR that holds the given class. Set parameters and a listener, then call {@code exec}. */
    public static MigAce fromJar(Class<?> classOfTheJar, String resource) {
        try (InputStream input = classOfTheJar.getResourceAsStream(resource)) {
            if (input == null) {
                throw new MigrationFailedException("No migration script at the resource \"" + resource + "\" of the JAR of " + classOfTheJar.getName() + ".", null, true, null);
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            input.transferTo(bytes);
            return new MigAce(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new MigrationFailedException("The migration script at the resource \"" + resource + "\" cannot be read: " + e.getMessage(), null, true, e);
        }
    }

    /** A script that is given as text. */
    public static MigAce script(String text) {
        return new MigAce(text);
    }

    /** A parameter of the run. The script reads it as the session setting {@code migace.<name>}; {@code schema} is the schema of the migration. */
    public MigAce parameter(String name, String value) {
        if (!name.matches("\\w+")) {
            throw new MigrationFailedException("The name of a parameter is made of letters, digits and underscores: \"" + name + "\".", null, true, null);
        }
        parameters.put(name, value);
        return this;
    }

    /** Where the notices of the database go. Without a listener they go to the logging of the JDK. */
    public MigAce onNotice(NoticeListener noticeListener) {
        this.listener = noticeListener;
        return this;
    }

    /** Runs the script on a connection of the data source. The connection is closed afterwards. */
    public void exec(DataSource dataSource) {
        try (Connection connection = dataSource.getConnection()) {
            exec(connection);
        } catch (SQLException e) {
            throw new MigrationFailedException(e.getMessage(), e.getSQLState(), false, e);
        }
    }

    /** Runs the script on the connection. The connection stays open and gets back the autocommit setting it had. */
    public void exec(Connection connection) {
        java.util.List<Script.Statement> statements = Script.read(script);
        try {
            boolean autoCommit = connection.getAutoCommit();
            // Every statement of the script is a transaction of its own.
            connection.setAutoCommit(true);
            try {
                for (Map.Entry<String, String> parameter : parameters.entrySet()) {
                    send(connection, "select set_config('migace." + parameter.getKey() + "', '" + parameter.getValue().replace("'", "''") + "', false)", null);
                }
                for (Script.Statement statement : statements) {
                    if (statement.guard == null || guardSays(send(connection, statement.guard, statement.label), statement)) {
                        send(connection, statement.sql, statement.label);
                    }
                }
            } finally {
                connection.setAutoCommit(autoCommit);
            }
        } catch (SQLException e) {
            throw new MigrationFailedException(e.getMessage(), e.getSQLState(), false, e);
        }
    }

    /**
     * Sends one statement. Returns the first values of its rows, up to two of them: enough to judge the answer of a guard.
     * The notices of the statement reach the listener, also when the statement fails.
     */
    private Object[] send(Connection connection, String sql, String label) {
        try (Statement statement = connection.createStatement()) {
            try {
                boolean hasRows = statement.execute(sql);
                java.util.List<Object> values = new java.util.ArrayList<>();
                if (hasRows) {
                    try (ResultSet rows = statement.getResultSet()) {
                        while (values.size() < 2 && rows.next()) {
                            values.add(rows.getObject(1));
                        }
                    }
                }
                return values.toArray();
            } finally {
                for (SQLWarning warning = statement.getWarnings(); warning != null; warning = warning.getNextWarning()) {
                    listener.notice(warning.getMessage());
                }
            }
        } catch (SQLException e) {
            throw new MigrationFailedException(label == null ? e.getMessage() : label + ": " + e.getMessage(), e.getSQLState(), false, e);
        }
    }

    /** A guard answers with one row that holds true or false. Any other answer is an error: the runner does not guess. */
    private static boolean guardSays(Object[] values, Script.Statement statement) {
        if (values.length == 1 && values[0] instanceof Boolean) {
            return (Boolean) values[0];
        }
        String answer = values.length == 0 ? "no row" : values.length > 1 ? "more than one row" : "a row without true or false";
        throw new MigrationFailedException("The guard before the statement at line " + statement.line + " returned " + answer + ".", null, false, null);
    }
}
