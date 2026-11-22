package org.openbrod.migace;

import java.io.Console;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/**
 * The runner as a program: {@code java -cp migace-runner.jar:<driver>.jar org.openbrod.migace.Main --url <jdbc url> --user <user> <script>}.
 *
 * <p>The password is read from the environment variable MIGACE_PASSWORD, or asked for. It is never an argument.
 */
public final class Main {

    static final String PASSWORD_VARIABLE = "MIGACE_PASSWORD";

    private static final String USAGE = String.join(System.lineSeparator(),
        "Usage: java -cp migace-runner.jar:<jdbc driver>.jar org.openbrod.migace.Main --url <jdbc url> --user <user> [options] <script file>",
        "",
        "  --url <jdbc url>        the address of the database",
        "  --user <user>           the user that runs the migration",
        "  --schema <schema>       the schema of the migration; default: the schema of the session",
        "  --param <name>=<value>  another parameter of the run; may be given several times",
        "",
        "The password is read from the environment variable " + PASSWORD_VARIABLE + ". Without it the program asks for it.",
        "Exit code: 0 after success, 1 after a failure of the migration, 2 if the call is wrong.");

    private Main() {
    }

    public static void main(String[] args) {
        Console console = System.console();
        System.exit(run(args, System.getenv(), System.out, System.err,
            console == null ? null : () -> new String(console.readPassword("Password: "))));
    }

    /** Asks the person at the keyboard for the password. */
    interface PasswordPrompt {
        String ask();
    }

    static int run(String[] args, Map<String, String> environment, PrintStream out, PrintStream err, PasswordPrompt prompt) {
        String url = null;
        String user = null;
        String scriptFile = null;
        Map<String, String> parameters = new LinkedHashMap<>();
        for (int index = 0; index < args.length; index++) {
            String argument = args[index];
            String value = index + 1 < args.length ? args[index + 1] : null;
            if (argument.equals("--url") && value != null) {
                url = value;
                index++;
            } else if (argument.equals("--user") && value != null) {
                user = value;
                index++;
            } else if (argument.equals("--schema") && value != null) {
                parameters.put("schema", value);
                index++;
            } else if (argument.equals("--param") && value != null && value.contains("=")) {
                parameters.put(value.substring(0, value.indexOf('=')), value.substring(value.indexOf('=') + 1));
                index++;
            } else if (!argument.startsWith("--") && scriptFile == null) {
                scriptFile = argument;
            } else {
                err.println("Unknown or incomplete option: " + (argument.startsWith("--") ? argument : "a second script file"));
                err.println(USAGE);
                return 2;
            }
        }
        if (url == null || user == null || scriptFile == null) {
            err.println(USAGE);
            return 2;
        }
        String password = environment.get(PASSWORD_VARIABLE);
        if (password == null && prompt != null) {
            password = prompt.ask();
        }
        Secrets secrets = new Secrets(url, password);
        try {
            MigAce migration = MigAce.script(new String(Files.readAllBytes(Paths.get(scriptFile)), StandardCharsets.UTF_8)).onNotice(out::println);
            parameters.forEach(migration::parameter);
            Properties properties = new Properties();
            properties.setProperty("user", user);
            if (password != null) {
                properties.setProperty("password", password);
            }
            try (Connection connection = DriverManager.getConnection(url, properties)) {
                migration.exec(connection);
            }
            return 0;
        } catch (IOException e) {
            err.println("The script file \"" + scriptFile + "\" cannot be read: " + e.getMessage());
            return 2;
        } catch (SQLException e) {
            err.println(secrets.hide("No connection to the database: " + e.getMessage()));
            return 1;
        } catch (MigrationFailedException e) {
            err.println(secrets.hide(e.getMessage()));
            return 1;
        }
    }

    /** Takes passwords out of a text before it is printed: the given one, and one that stands inside the address of the database. */
    static final class Secrets {
        private final String url;
        private final String password;

        Secrets(String url, String password) {
            this.url = url;
            this.password = password;
        }

        String hide(String text) {
            String hidden = text.replace(url, hideIn(url));
            if (password != null && !password.isEmpty()) {
                hidden = hidden.replace(password, "***");
            }
            return hideIn(hidden);
        }

        private static String hideIn(String text) {
            return text
                .replaceAll("(?i)(password=)[^&;\\s]*", "$1***")
                .replaceAll("(://[^/:@\\s]*:)[^@/\\s]*@", "$1***@");
        }
    }
}
