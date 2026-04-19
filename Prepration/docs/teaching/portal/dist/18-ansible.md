# Ansible

## Prerequisites

- **Basic Linux CLI:** You must be comfortable with SSH, file paths, package managers (`apt`, `yum`), and systemd service commands (`systemctl start/stop/enable`). Ansible automates what you would otherwise do manually over SSH — you need to know what you're automating.
- **YAML syntax:** Playbooks, inventory files, and variable files are all YAML. Understand sequences (lists), mappings (dicts), and indentation rules. A single misplaced space breaks a playbook.
- **SSH key concepts:** Ansible connects to target hosts over SSH using key-based authentication. You must understand `ssh-keygen`, `ssh-copy-id`, the `~/.ssh/authorized_keys` file, and the difference between a public and private key.
- **Jinja2 templating basics:** Ansible uses Jinja2 for templates and variable interpolation. `{{ variable }}`, `{% if %}`, and `{% for %}` will appear constantly.

---

## What & Why

Ansible is an agentless automation tool. Unlike Chef, Puppet, or SaltStack, there is **no daemon running on target hosts**. Ansible connects over plain SSH, pushes a small Python script, executes it, and disconnects. The target host needs only Python and SSH — no agent installation, no firewall ports to open beyond SSH.

**Why Ansible over raw shell scripts:**

1. **Idempotency.** A shell script that installs Nginx will fail if Nginx is already installed. An Ansible task using the `apt` module checks whether Nginx is already the desired version and skips the install if nothing needs to change. Running a playbook 10 times is safe — it only changes what's out of state.
2. **Declarative intent.** You describe what the system should look like, not the sequence of commands to get there. `state: present` means "ensure this package is installed", not "run apt-get install".
3. **Jinja2 templating.** Generate environment-specific config files from a single template. `nginx.conf.j2` with `{{ server_name }}` renders differently for dev, staging, and production without maintaining three separate files.
4. **Vault for secrets at rest.** Encrypt sensitive values (database passwords, API keys) with AES-256 and commit the encrypted file to Git. The decryption key never touches the repository.

**TML uses Ansible for:** Generating per-environment Helm `values.yaml` files via Jinja2 templates, encrypted secrets committed to `ep-pipelines` using Ansible Vault, and triggering deploys from Jenkins pipelines on MES4/MES4-EV.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Inventory** | A list of target hosts. Can be static (`.ini` or `.yaml` file) or dynamic (script or plugin that queries AWS/GCP). |
| **Playbook** | A YAML file containing one or more Plays. The top-level unit you run with `ansible-playbook`. |
| **Play** | Maps a set of hosts to a list of tasks. A playbook can have multiple plays targeting different host groups. |
| **Task** | A call to an Ansible module with specific arguments. `ansible.builtin.apt: name=nginx state=present` is one task. |
| **Module** | The unit of work. Built-ins: `apt`, `copy`, `template`, `service`, `command`, `shell`, `file`, `user`, `git`. |
| **Handler** | A task that runs only when notified by another task. Used for restart-on-change patterns. |
| **Role** | A structured way to package tasks, handlers, templates, variables, and defaults into a reusable unit. |
| **Variable** | Named values that parametrize playbook behaviour. Multiple sources, strict precedence order. |
| **Idempotency** | Running the same playbook multiple times produces the same result. Ansible modules are designed to be idempotent. |

### Variable Precedence (lowest to highest)

```
defaults/main.yml (role defaults)
  → group_vars/all/
    → group_vars/{group}/
      → host_vars/{host}/
        → vars in play (vars:)
          → vars_files:
            → vars in task (vars:)
              → registered variables
                → set_facts
                  → extra-vars (-e flag) ← highest priority
```

Understanding this precedence is critical. If a variable isn't taking the value you expect, check which level is overriding it.

---

## Installation & Setup

### Install Ansible

```bash
# Python pip (recommended — gets the latest version)
pip install ansible

# Verify installation
ansible --version
# ansible [core 2.16.x]

# Install additional collections
ansible-galaxy collection install amazon.aws
ansible-galaxy collection install community.general
```

### Configure SSH Key Authentication

```bash
# Generate a dedicated key for Ansible
ssh-keygen -t ed25519 -C "ansible@yourserver" -f ~/.ssh/ansible_ed25519

# Copy the public key to each target host
ssh-copy-id -i ~/.ssh/ansible_ed25519.pub user@192.168.1.10
ssh-copy-id -i ~/.ssh/ansible_ed25519.pub user@192.168.1.11

# Test connectivity
ansible -i "192.168.1.10,192.168.1.11," all \
  -m ansible.builtin.ping \
  --private-key ~/.ssh/ansible_ed25519 \
  -u ubuntu
```

Expected output:
```
192.168.1.10 | SUCCESS => { "changed": false, "ping": "pong" }
192.168.1.11 | SUCCESS => { "changed": false, "ping": "pong" }
```

### Create ansible.cfg

```ini
[defaults]
inventory      = inventory/
private_key_file = ~/.ssh/ansible_ed25519
remote_user    = ubuntu
host_key_checking = False

[ssh_connection]
pipelining = True    # major performance improvement (see Expert section)
```

Place `ansible.cfg` in the project root. Ansible searches for it in the current directory, then `~/.ansible.cfg`, then `/etc/ansible/ansible.cfg`.

---

## Beginner

### Static Inventory File

```ini
# inventory/hosts.ini

[web]
web-01 ansible_host=10.0.1.10
web-02 ansible_host=10.0.1.11

[db]
db-01  ansible_host=10.0.2.10
db-02  ansible_host=10.0.2.11

[app:children]
web
db

[all:vars]
ansible_user=ubuntu
ansible_python_interpreter=/usr/bin/python3
```

Groups can nest (`app` contains `web` and `db`). `[all:vars]` sets variables for every host in the inventory.

### Simple Playbook

```yaml
# playbooks/install-nginx.yml
---
- name: Install and configure Nginx
  hosts: web
  become: true           # sudo (privilege escalation)

  vars:
    nginx_port: 80
    server_name: "{{ inventory_hostname }}"

  tasks:
    - name: Update apt cache
      ansible.builtin.apt:
        update_cache: true
        cache_valid_time: 3600   # only update if cache is >1 hour old

    - name: Install Nginx
      ansible.builtin.apt:
        name: nginx
        state: present            # ensure installed, don't upgrade

    - name: Copy Nginx config
      ansible.builtin.template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        owner: root
        group: root
        mode: '0644'
      notify: Restart Nginx       # triggers handler

    - name: Ensure Nginx is started and enabled
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: Restart Nginx
      ansible.builtin.service:
        name: nginx
        state: restarted
```

Run it:
```bash
ansible-playbook -i inventory/hosts.ini playbooks/install-nginx.yml
```

Ansible shows a task-by-task output with `ok` (no change), `changed` (change made), or `failed`. At the end it prints a `PLAY RECAP` summarising outcomes per host.

### Variables and Variable Files

```yaml
# vars/app-config.yml
app_name: ep-mes4-api
app_version: "2.4.1"
jvm_heap_min: 512m
jvm_heap_max: 2g
spring_profiles: prod,monitoring
database:
  host: db-01.internal
  port: 5432
  name: mes4_prod

# In the playbook:
  vars_files:
    - vars/app-config.yml
  tasks:
    - name: Print app version
      ansible.builtin.debug:
        msg: "Deploying {{ app_name }} version {{ app_version }}"
    - name: Access nested variable
      ansible.builtin.debug:
        msg: "Database: {{ database.host }}:{{ database.port }}/{{ database.name }}"
```

### Template Module with Jinja2

```jinja2
{# templates/application.properties.j2 #}
spring.application.name={{ app_name }}
spring.profiles.active={{ spring_profiles }}

# Database
spring.datasource.url=jdbc:postgresql://{{ database.host }}:{{ database.port }}/{{ database.name }}
spring.datasource.username={{ database.username }}
spring.datasource.password={{ database.password }}

# JVM
-Xms{{ jvm_heap_min }}
-Xmx{{ jvm_heap_max }}

# Dynamic block — only include monitoring config if enabled
{% if monitoring_enabled | default(false) %}
management.endpoint.prometheus.enabled=true
management.endpoints.web.exposure.include=prometheus,health
{% endif %}
```

```yaml
    - name: Deploy application config
      ansible.builtin.template:
        src: templates/application.properties.j2
        dest: /opt/ep/{{ app_name }}/application.properties
        mode: '0640'
      notify: Restart Application
```

The template renders with the current play's variables. The same template produces different output for each environment.

---

## Intermediate

### Role Structure

Roles organise tasks, handlers, templates, and variables into a reusable, portable unit.

```
roles/
└── spring-boot-service/
    ├── tasks/
    │   └── main.yml          # main task list
    ├── handlers/
    │   └── main.yml          # handlers (restart, reload)
    ├── templates/
    │   ├── systemd.service.j2
    │   └── logback.xml.j2
    ├── defaults/
    │   └── main.yml          # default variable values (lowest precedence)
    ├── vars/
    │   └── main.yml          # role-internal variables (higher precedence)
    ├── files/
    │   └── health-check.sh   # static files copied with copy module
    └── meta/
        └── main.yml          # role metadata and dependencies
```

**`defaults/main.yml`:**
```yaml
# Low-precedence defaults — callers can override these
service_user: appuser
service_group: appuser
jvm_heap_min: 256m
jvm_heap_max: 1g
spring_profiles: default
app_port: 8080
```

**`tasks/main.yml`:**
```yaml
---
- name: Create service user
  ansible.builtin.user:
    name: "{{ service_user }}"
    system: true
    shell: /bin/false

- name: Create application directory
  ansible.builtin.file:
    path: "/opt/{{ app_name }}"
    state: directory
    owner: "{{ service_user }}"
    mode: '0755'

- name: Deploy JAR
  ansible.builtin.copy:
    src: "{{ app_jar_path }}"
    dest: "/opt/{{ app_name }}/{{ app_name }}.jar"
    owner: "{{ service_user }}"
    mode: '0644'
  notify: Restart service

- name: Deploy systemd unit
  ansible.builtin.template:
    src: systemd.service.j2
    dest: "/etc/systemd/system/{{ app_name }}.service"
    mode: '0644'
  notify:
    - Reload systemd
    - Restart service
```

**Using the role in a playbook:**
```yaml
- name: Deploy IPMS4 services
  hosts: ipms4_prod
  become: true
  roles:
    - role: spring-boot-service
      vars:
        app_name: ep-production-broadcast
        app_jar_path: /artifacts/ep-production-broadcast.jar
        jvm_heap_max: 4g
        spring_profiles: prod,monitoring
```

### Jinja2 Filters and Loops

```yaml
# Loop over a list with loop:
- name: Install multiple packages
  ansible.builtin.apt:
    name: "{{ item }}"
    state: present
  loop:
    - openjdk-21-jdk
    - curl
    - jq
    - awscli

# Loop over a list of dicts
- name: Create application directories
  ansible.builtin.file:
    path: "{{ item.path }}"
    owner: "{{ item.owner | default('root') }}"
    mode: "{{ item.mode | default('0755') }}"
    state: directory
  loop:
    - { path: /opt/ep/config,  owner: appuser }
    - { path: /opt/ep/logs,    owner: appuser, mode: '0750' }
    - { path: /var/run/ep,     owner: appuser }
```

**Jinja2 filters in templates and tasks:**
```yaml
# default: provide fallback if variable is undefined
app_port: "{{ service_port | default(8080) }}"

# upper/lower: case conversion
log_level: "{{ env_log_level | default('info') | upper }}"   # → INFO

# replace: string substitution
safe_name: "{{ app_name | replace('-', '_') }}"   # ep-mes4-api → ep_mes4_api

# to_json: serialize dict/list to JSON string
config_json: "{{ app_config | to_json }}"

# selectattr: filter list by attribute
prod_services: "{{ services | selectattr('env', 'equalto', 'prod') | list }}"

# join: join list elements
profile_string: "{{ spring_profiles | join(',') }}"   # ['prod', 'monitoring'] → prod,monitoring
```

### Register and When: Conditional Execution

```yaml
- name: Check if application is running
  ansible.builtin.command: systemctl is-active ep-production-broadcast
  register: service_status
  changed_when: false          # this task never reports "changed"
  failed_when: false           # don't fail even if service is inactive

- name: Print service status
  ansible.builtin.debug:
    msg: "Service is {{ service_status.stdout }}"

- name: Create initial config only if service has never run
  ansible.builtin.template:
    src: templates/initial-config.j2
    dest: /opt/ep/config/application.properties
  when: service_status.stdout != 'active'

- name: Run DB migration only on first deploy
  ansible.builtin.command: java -jar /opt/ep/app.jar --migrate
  when:
    - service_status.stdout != 'active'
    - not skip_migration | default(false)
```

---

## Advanced

### Ansible Vault: Encrypted Secrets at Rest

Vault encrypts files or individual variables with AES-256. Encrypted content is safe to commit to Git — only someone with the Vault password can decrypt it.

```bash
# Encrypt a file
ansible-vault encrypt vars/secrets.yml

# Create a new encrypted file
ansible-vault create vars/secrets.yml

# Edit an encrypted file (decrypts → opens editor → re-encrypts on save)
ansible-vault edit vars/secrets.yml

# View without editing
ansible-vault view vars/secrets.yml

# Decrypt in place (use sparingly — avoid unencrypted secrets on disk)
ansible-vault decrypt vars/secrets.yml

# Re-encrypt with a new password
ansible-vault rekey vars/secrets.yml

# Run playbook with vault password from a file (used in CI/CD)
ansible-playbook site.yml --vault-password-file vault_pass.txt

# Run with multiple vault passwords (multiple vault IDs)
ansible-playbook site.yml \
  --vault-id dev@vault-pass-dev.txt \
  --vault-id prod@vault-pass-prod.txt
```

**Group vars pattern with vault:**
```
group_vars/
└── ipms4_prod/
    ├── vars.yml      # plaintext variables — safe to commit
    └── vault.yml     # encrypted variables — safe to commit (encrypted)
```

`vars.yml` references vault variables:
```yaml
# group_vars/ipms4_prod/vars.yml
db_host: prod-rds.internal
db_port: 5432
db_password: "{{ vault_db_password }}"    # references vault variable
```

`vault.yml` (encrypted content, shows decrypted form):
```yaml
# group_vars/ipms4_prod/vault.yml (ENCRYPTED)
vault_db_password: "s3cr3t-pr0duction-passw0rd"
vault_slack_token: "xoxb-xxx-yyy-zzz"
```

This pattern keeps the structure visible in `vars.yml` while keeping values secret in `vault.yml`.

### Dynamic Inventory with AWS EC2 Plugin

Instead of maintaining a static `hosts.ini` that you update every time EC2 instances are created or terminated, the AWS EC2 inventory plugin queries the AWS API at runtime.

```yaml
# inventory/aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - ap-south-1

filters:
  instance-state-name: running
  tag:Environment: production
  tag:Product: ipms4

keyed_groups:
  - key: tags.Role         # create group per Role tag value
    prefix: role
  - key: tags.Service      # create group per Service tag value
    prefix: service

hostnames:
  - private-ip-address     # use private IP as hostname

compose:
  ansible_user: "'ubuntu'"
  ansible_ssh_private_key_file: "'~/.ssh/ansible_ed25519'"
```

```bash
# Test the dynamic inventory
ansible-inventory -i inventory/aws_ec2.yml --list

# Run a playbook against EC2 instances
ansible-playbook -i inventory/aws_ec2.yml deploy.yml
```

EC2 instances tagged `Role=webserver` are automatically grouped as `role_webserver`. Your playbook targets `hosts: role_webserver` and automatically picks up new instances as they're launched.

### Async Tasks and Delegate_to

For long-running operations (restarting a service that takes 5 minutes to warm up), use async to fire and forget, then poll:

```yaml
- name: Start database migration (async — can take up to 30 min)
  ansible.builtin.command: java -jar /opt/ep/migrate.jar
  async: 1800              # max runtime in seconds (30 min)
  poll: 0                  # start async, don't wait
  register: migration_job

- name: Wait for migration to complete
  ansible.builtin.async_status:
    jid: "{{ migration_job.ansible_job_id }}"
  register: job_result
  until: job_result.finished
  retries: 60
  delay: 30               # check every 30 seconds

- name: Log migration result
  ansible.builtin.debug:
    msg: "Migration completed: {{ job_result.rc }}"
```

`delegate_to` runs a task on a specific host regardless of which host is in the current play's scope:

```yaml
- name: Update load balancer to remove host before deploy
  ansible.builtin.uri:
    url: "http://haproxy.internal/api/drain/{{ inventory_hostname }}"
    method: POST
  delegate_to: haproxy.internal    # runs on haproxy, not the app server

- name: Deploy new version
  ansible.builtin.copy:
    src: "{{ app_jar }}"
    dest: /opt/ep/app.jar
  notify: Restart service

- name: Re-add host to load balancer after deploy
  ansible.builtin.uri:
    url: "http://haproxy.internal/api/enable/{{ inventory_hostname }}"
    method: POST
  delegate_to: haproxy.internal
```

---

## Expert

### Ansible Tower / AWX

AWX is the open-source upstream of Red Hat Ansible Tower. It provides a web UI, REST API, RBAC, job scheduling, and an audit trail for all Ansible runs.

Key concepts in AWX/Tower:
- **Inventory:** Web-managed inventories with dynamic inventory support
- **Credential:** Encrypted SSH keys, Vault passwords, cloud API keys stored in the AWX database
- **Job Template:** A saved combination of playbook + inventory + credentials + extra vars. A single click runs the playbook.
- **Survey:** Form-based input for job templates. A survey prompt asks "Which environment?" before running a deploy playbook — no CLI required.
- **Workflow:** Chain multiple job templates with conditional branching (run template B if template A succeeds, run template C if A fails)
- **Schedule:** Run job templates on a cron schedule without any CI involvement

For TML, AWX/Tower would allow non-engineers to trigger Ansible deploys through a web UI without needing SSH access or CLI knowledge.

### Performance Tuning

```ini
# ansible.cfg performance settings
[defaults]
forks = 20                     # run tasks on 20 hosts in parallel (default is 5)
gathering = smart              # only gather facts if not cached
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_fact_cache
fact_caching_timeout = 86400   # cache facts for 24 hours

[ssh_connection]
pipelining = True              # send multiple Python scripts over one SSH connection
                               # reduces SSH roundtrips from ~5 to ~1 per task
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
                               # SSH multiplexing: reuse established connections
control_path_dir = /tmp/ansible-ssh
```

`pipelining = True` is the single biggest performance improvement. It reduces a 10-host, 20-task playbook from ~200 SSH connections to ~20. The only requirement is that `requiretty` must NOT be set in the target's `/etc/sudoers` — which it isn't on most cloud instances by default.

### Testing Ansible with Molecule

Molecule provides a testing framework for Ansible roles: it spins up Docker containers (or VMs), runs your role against them, runs a verifier, and destroys everything.

```bash
# Install molecule
pip install molecule molecule-docker

# Initialise molecule for an existing role
cd roles/spring-boot-service
molecule init scenario --driver-name docker

# molecule/default/molecule.yml
---
driver:
  name: docker
platforms:
  - name: ubuntu-focal
    image: geerlingguy/docker-ubuntu2004-ansible
    pre_build_image: true
    command: /sbin/init
    privileged: true
provisioner:
  name: ansible
verifier:
  name: ansible

# Run full test: create → converge (run role) → verify → destroy
molecule test

# Just run the role without destroying
molecule converge

# Run the verifier only
molecule verify

# Drop into container for debugging
molecule login
```

**`molecule/default/verify.yml`:**
```yaml
---
- name: Verify spring-boot-service role
  hosts: all
  gather_facts: false
  tasks:
    - name: Ensure service file exists
      ansible.builtin.stat:
        path: /etc/systemd/system/test-app.service
      register: service_file
    - ansible.builtin.assert:
        that: service_file.stat.exists

    - name: Check service is running
      ansible.builtin.command: systemctl is-active test-app
      register: result
      changed_when: false
    - ansible.builtin.assert:
        that: result.stdout == 'active'
```

### Custom Modules

When built-in modules don't cover a use case, write a Python module in the `library/` directory of your playbook project.

```python
# library/ep_config_check.py
from ansible.module_utils.basic import AnsibleModule
import json
import urllib.request

def main():
    module = AnsibleModule(
        argument_spec=dict(
            url=dict(type='str', required=True),
            expected_version=dict(type='str', required=True),
        )
    )

    url = module.params['url']
    expected = module.params['expected_version']

    try:
        with urllib.request.urlopen(f"{url}/actuator/info") as response:
            data = json.loads(response.read())
            actual = data.get('build', {}).get('version', 'unknown')
            if actual == expected:
                module.exit_json(changed=False, version=actual)
            else:
                module.fail_json(msg=f"Version mismatch: expected {expected}, got {actual}")
    except Exception as e:
        module.fail_json(msg=str(e))

if __name__ == '__main__':
    main()
```

```yaml
- name: Verify deployed version
  ep_config_check:
    url: "http://{{ inventory_hostname }}:9096"
    expected_version: "{{ app_version }}"
```

---

## In the TML Codebase

**Jinja2 template generation for Helm values:** The `ep-pipelines` repository contains Jinja2 templates (`app-config/{env}/*.j2`) that generate Helm `values.yaml` files per environment. The template uses variables like `{{ service.image.tag | default('latest') }}`, `{{ service.replicas | default(1) }}`, and `{{ database.url }}`. An Ansible playbook renders the template and writes the output to the Helm chart overlay directory.

**Vault-encrypted secrets:** Database passwords, ECR registry URLs with auth tokens, Slack webhook URLs, and external API keys are stored in `vault.yml` files committed to `ep-pipelines`. The Vault password is stored in Jenkins Credentials Store and passed to playbooks with `--vault-password-file vault_pass`:
```groovy
withCredentials([file(credentialsId: 'VAULT_PASSWORD_FILE', variable: 'VAULT_PASS')]) {
    sh """
        ansible-playbook \\
            -i inventory/${params.ENVIRONMENT} \\
            deploy.yml \\
            --vault-password-file \$VAULT_PASS \\
            -e "image_tag=${env.GIT_COMMIT}"
    """
}
```

**Group vars structure:**
```
group_vars/
├── all/
│   ├── vars.yml      # variables common to all environments
│   └── vault.yml     # encrypted common secrets
├── ipms4_prod/
│   ├── vars.yml      # prod-specific variables
│   └── vault.yml     # prod-specific encrypted secrets
└── ipms4_dev/
    ├── vars.yml
    └── vault.yml
```

**Ansible-triggered deploys from Jenkins:** After building and pushing a Docker image, the Jenkins pipeline runs an Ansible playbook that updates the Helm values and triggers a `helm upgrade`. On MES4 (not yet on ArgoCD), Ansible directly calls `kubectl apply` or `helm upgrade --install` via the Kubernetes collection.

---

## Quick Reference

### Playbook Skeleton

```yaml
---
- name: Deploy application
  hosts: TARGET_GROUP
  become: true
  vars_files:
    - vars/app-config.yml
    - vars/secrets.yml        # vault-encrypted

  roles:
    - spring-boot-service

  tasks:
    - name: Verify deployment
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:{{ app_port }}/actuator/health"
        status_code: 200
```

### Vault Command Reference

| Command | Description |
|---|---|
| `ansible-vault encrypt FILE` | Encrypt a file in place |
| `ansible-vault decrypt FILE` | Decrypt a file in place |
| `ansible-vault edit FILE` | Decrypt, open in editor, re-encrypt |
| `ansible-vault view FILE` | View decrypted content without editing |
| `ansible-vault rekey FILE` | Change the encryption password |
| `ansible-vault encrypt_string 'value'` | Encrypt a single string value |

### Common Jinja2 Filters

| Filter | Example | Output |
|---|---|---|
| `default` | `{{ port \| default(8080) }}` | `8080` if `port` undefined |
| `upper` | `{{ 'info' \| upper }}` | `INFO` |
| `lower` | `{{ 'PROD' \| lower }}` | `prod` |
| `replace` | `{{ 'ep-api' \| replace('-','_') }}` | `ep_api` |
| `join` | `{{ list \| join(',') }}` | `a,b,c` |
| `to_json` | `{{ dict \| to_json }}` | JSON string |
| `from_json` | `{{ str \| from_json }}` | parsed dict |
| `selectattr` | `{{ items \| selectattr('active') \| list }}` | filtered list |
| `map` | `{{ users \| map(attribute='name') \| list }}` | list of names |
| `int` | `{{ '8080' \| int }}` | integer `8080` |
| `length` | `{{ list \| length }}` | count of items |

### ansible.cfg Optimisation Settings

```ini
[defaults]
forks = 20
gathering = smart
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts
fact_caching_timeout = 86400

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
```
